import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

// Konfigurasi Firebase Anda
const firebaseConfig = {
    apiKey: "AIzaSyAJ7T0iyJqbPGz4Ms45-UefvXFWBTHyebM", // GANTI DENGAN API KEY ANDA
    authDomain: "realtimechart-c036c.firebaseapp.com",
    databaseURL: "https://realtimechart-c036c-default-rtdb.firebaseio.com",
    projectId: "realtimechart-c036c",
    storageBucket: "realtimechart-c036c.firebasestorage.app",
    messagingSenderId: "542585916954",
    appId: "1:542585916954:web:e821db7141f904ccfbcba3",
    measurementId: "G-JDT4BZKVFE"
};

console.log("Memulai inisialisasi Firebase...");
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
// PENTING: Menunjuk ke node 'dataPajak' sesuai dengan JSON yang diberikan
const dbRef = ref(db, 'dataPajak');

// Variabel global untuk menyimpan data Firebase
let allFirebaseData = null;
// Variabel global untuk menyimpan rentang persentase perubahan absolut maksimum untuk stabilisasi Y-axis
let globalMaxAbsPercentageChange = 0;


// Muat Google Charts
google.charts.load('current', { 'packages': ['corechart'] });
google.charts.setOnLoadCallback(function () {
    console.log("Google Charts loaded.");
    listenForFirebaseData();
});

// Fungsi untuk menyingkat angka besar
function formatNumberShort(num) {
    const absNum = Math.abs(num);
    if (absNum >= 1_000_000_000_000) { // Triliun
        return (num / 1_000_000_000_000).toFixed(2) + ' T';
    }
    if (absNum >= 1_000_000_000) { // Miliar
        return (num / 1_000_000_000).toFixed(2) + ' M';
    }
    if (absNum >= 1_000_000) { // Juta
        return (num / 1_000_000).toFixed(2) + ' JT';
    }
    return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Fungsi format Rupiah
function formatRupiah(angka, useShortFormat = false) {
    const number = Number(angka);
    if (isNaN(number)) {
        return "N/A";
    }

    if (useShortFormat) {
        return "Rp " + formatNumberShort(number);
    } else {
        return "Rp " + number.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
}

// Fungsi format Persentase
function formatPersentase(value) {
    const number = Number(value);
    if (isNaN(number)) {
        return "N/A";
    }
    return number.toFixed(2) + "%";
}

// Fungsi animasi angka untuk total realisasi counter di header
function animateNumber(element, start, end, duration = 1000) {
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue = start + (end - start) * progress;
        element.textContent = "Rp " + Math.floor(currentValue).toLocaleString("id-ID");
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

// Update waktu realtime
function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('id-ID', options);
    const timeStr = now.toLocaleTimeString('id-ID');
    document.getElementById("datetime").innerText = `${dateStr} - ${timeStr}`;
}

updateDateTime();
setInterval(updateDateTime, 1000);

// Fungsi untuk menggambar atau memperbarui chart Google Charts (Realisasi & Target Tahunan)
function drawRealisasiChart(firebaseData) {
    const dataTable = new google.visualization.DataTable();
    dataTable.addColumn('string', 'Tahun');

    const showRealisasiOverall = document.getElementById('showRealisasiOverall').checked;
    const showTargetOverall = document.getElementById('showTargetOverall').checked;

    if (!showRealisasiOverall && !showTargetOverall) {
        const realisasiChartElem = document.getElementById('realisasiChart');
        if (realisasiChartElem) {
            realisasiChartElem.innerHTML = '<p style="text-align: center; color: #555;">Pilih setidaknya satu opsi (Realisasi atau Target) untuk menampilkan grafik.</p>';
        }
        return;
    }

    const chartColors = [];
    let seriesIndex = 0;

    if (showRealisasiOverall) {
        dataTable.addColumn('number', 'Total Realisasi Pajak');
        dataTable.addColumn({ type: 'string', role: 'annotation' });
        chartColors.push('#007bff'); // Biru
        seriesIndex++;
    }
    if (showTargetOverall) {
        dataTable.addColumn('number', 'Total Target Pajak');
        dataTable.addColumn({ type: 'string', role: 'annotation' });
        chartColors.push('#ff9800'); // Oranye
        seriesIndex++;
    }

    let totalRealisasiOverallValue = 0; // Mengubah nama variabel agar tidak konflik dengan ID div
    let totalTargetOverallValue = 0;

    const chartData = [];
    for (let year = 2020; year <= 2025; year++) {
        let currentYearTotalRealisasi = 0;
        let currentYearTotalTarget = 0;

        Object.values(firebaseData).forEach(item => {
            const yearData = item[year];
            if (yearData) {
                if (yearData.Realisasi_sd_Tahun) {
                    currentYearTotalRealisasi += parseNumeric(yearData.Realisasi_sd_Tahun);
                }
                if (yearData.Target) {
                    currentYearTotalTarget += parseNumeric(yearData.Target);
                }
            }
        });

        const row = [year.toString()];
        if (showRealisasiOverall) {
            row.push(currentYearTotalRealisasi);
            row.push(formatRupiah(currentYearTotalRealisasi));
        }
        if (showTargetOverall) {
            row.push(currentYearTotalTarget);
            row.push(formatRupiah(currentYearTotalTarget));
        }
        chartData.push(row);
        totalRealisasiOverallValue += currentYearTotalRealisasi;
        totalTargetOverallValue += currentYearTotalTarget;
    }
    dataTable.addRows(chartData);

    const totalDisplayElement = document.getElementById('totalRealisasiOverallChartData'); // Menggunakan ID yang baru
    if (totalDisplayElement) {
        // Menampilkan total realisasi atau target berdasarkan apa yang dipilih
        if (showRealisasiOverall && showTargetOverall) {
            totalDisplayElement.textContent = `Realisasi: ${formatRupiah(totalRealisasiOverallValue)} | Target: ${formatRupiah(totalTargetOverallValue)}`;
        } else if (showRealisasiOverall) {
            totalDisplayElement.textContent = `Total Realisasi: ${formatRupiah(totalRealisasiOverallValue)}`;
        } else if (showTargetOverall) {
            totalDisplayElement.textContent = `Total Target: ${formatRupiah(totalTargetOverallValue)}`;
        } else {
            totalDisplayElement.textContent = ''; // Kosongkan jika tidak ada yang dipilih
        }
    } else {
        console.warn("Element with ID 'totalRealisasiOverallChartData' not found.");
    }

    const options = {
        title: 'Perbandingan Total Realisasi dan Target Pajak per Tahun',
        titleTextStyle: {
            color: '#333',
            fontSize: 16
        },
        curveType: 'function',
        legend: { position: 'bottom' },
        colors: chartColors,
        backgroundColor: '#ffffff',
        chartArea: { width: '85%', height: '70%' },
        vAxis: {
            title: 'Total Realisasi / Target (Rp)',
            titleTextStyle: { color: '#555', fontSize: 14 },
            format: 'short',
            gridlines: { color: '#eee' },
            textStyle: { color: '#555' },
            viewWindow: {
                min: 0
            },
        },
        hAxis: {
            title: 'Tahun',
            titleTextStyle: { color: '#555', fontSize: 14 },
            textStyle: { color: '#555' }
        },
        tooltip: {
            isHtml: false,
            textStyle: { fontSize: 12 },
            trigger: 'focus'
        },
        annotations: {
            alwaysOutside: true,
            textStyle: {
                fontSize: 12,
                color: '#000',
                auraColor: 'none'
            }
        },
        seriesType: 'bars',
        series: {} // Akan diisi secara dinamis
    };

    // Mengisi options.series secara dinamis
    let currentSeriesIndex = 0;
    if (showRealisasiOverall) {
        options.series[currentSeriesIndex] = { targetAxisIndex: 0 };
        currentSeriesIndex++;
    }
    if (showTargetOverall) {
        options.series[currentSeriesIndex] = { targetAxisIndex: 0 };
        currentSeriesIndex++;
    }


    // Menerapkan formatter ke kolom data yang relevan
    let dataColumnIndex = 1; // Mulai dari kolom data pertama
    if (showRealisasiOverall) {
        const formatter = new google.visualization.NumberFormat({ prefix: 'Rp ', groupingUsed: true, fractionDigits: 0 });
        formatter.format(dataTable, dataColumnIndex);
        dataColumnIndex += 2; // Lewati kolom anotasi
    }
    if (showTargetOverall) {
        const formatter = new google.visualization.NumberFormat({ prefix: 'Rp ', groupingUsed: true, fractionDigits: 0 });
        formatter.format(dataTable, dataColumnIndex);
        dataColumnIndex += 2; // Lewati kolom anotasi
    }


    const chart = new google.visualization.ColumnChart(document.getElementById('realisasiChart'));

    chart.draw(dataTable, options);

    window.addEventListener('resize', function () {
        chart.draw(dataTable, options);
    });
}

// Fungsi Menggambar atau memperbarui chart garis untuk Jenis Pajak (Area Chart)
function drawJenisPajakChart(firebaseData, selectedJenisPajak = 'All') {
    const dataTable = new google.visualization.DataTable();
    dataTable.addColumn('string', 'Tahun');

    const showRealisasiArea = document.getElementById('showRealisasiArea').checked;
    const showTargetArea = document.getElementById('showTargetArea').checked;

    if (!showRealisasiArea && !showTargetArea) {
        const jenisPajakChartElem = document.getElementById('jenisPajakChart');
        if (jenisPajakChartElem) {
            jenisPajakChartElem.innerHTML = '<p style="text-align: center; color: #555;">Pilih setidaknya satu opsi (Realisasi atau Target) untuk menampilkan grafik.</p>';
        }
        return;
    }

    const jenisPajakKeys = Object.keys(firebaseData);
    const baseChartColors = [
        '#4285F4', '#EA4335', '#FBBC05', '#34A853',
        '#FF6347', '#4682B4', '#DA70D6', '#3CB371',
        '#FFD700', '#ADFF2F', '#FF4500', '#1E90FF',
        '#8A2BE2', '#A52A2A', '#DEB887', '#5F9EA0'
    ];
    const usedColors = [];
    let colorCount = 0;

    let jenisPajakToShow = [];
    if (selectedJenisPajak === 'All') {
        jenisPajakToShow = jenisPajakKeys;
    } else {
        jenisPajakToShow = [selectedJenisPajak];
    }

    jenisPajakToShow.forEach(jpKey => {
        const jenisPajakName = firebaseData[jpKey].Jenis_Pajak || jpKey;
        if (showRealisasiArea) {
            dataTable.addColumn('number', `${jenisPajakName} (Realisasi)`);
            dataTable.addColumn({ type: 'string', role: 'annotation' });
            usedColors.push(baseChartColors[colorCount % baseChartColors.length]);
            colorCount++;
        }
        if (showTargetArea) {
            dataTable.addColumn('number', `${jenisPajakName} (Target)`);
            dataTable.addColumn({ type: 'string', role: 'annotation' });
            usedColors.push(baseChartColors[colorCount % baseChartColors.length]);
            colorCount++;
        }
    });

    const chartData = [];
    for (let year = 2020; year <= 2025; year++) {
        const row = [year.toString()];
        jenisPajakToShow.forEach(jpKey => {
            const yearData = firebaseData[jpKey][year];
            const realisasi = yearData ? parseNumeric(yearData.Realisasi_sd_Tahun || 0) : 0;
            const target = yearData ? parseNumeric(yearData.Target || 0) : 0;

            if (showRealisasiArea) {
                row.push(realisasi);
                row.push(formatRupiah(realisasi));
            }
            if (showTargetArea) {
                row.push(target);
                row.push(formatRupiah(target));
            }
        });
        chartData.push(row);
    }
    dataTable.addRows(chartData);

    const options = {
        title: `Pertumbuhan Realisasi dan Target Pajak (${selectedJenisPajak === 'All' ? 'Semua Jenis Pajak' : firebaseData[selectedJenisPajak].Jenis_Pajak}) (2020 - 2025)`,
        titleTextStyle: {
            color: '#333',
            fontSize: 16
        },
        curveType: 'function',
        legend: { position: 'bottom' },
        colors: usedColors,
        backgroundColor: '#ffffff',
        chartArea: { width: '85%', height: '70%' },
        vAxis: {
            title: 'Total Realisasi / Target (Rp)',
            titleTextStyle: { color: '#555', fontSize: 14 },
            format: 'short',
            gridlines: { color: '#eee' },
            textStyle: { color: '#555' },
            viewWindow: {
                min: 0
            },
        },
        hAxis: {
            title: 'Tahun',
            titleTextStyle: { color: '#555', fontSize: 14 },
            textStyle: { color: '#555' }
        },
        tooltip: {
            isHtml: false,
            textStyle: { fontSize: 12 },
            trigger: 'focus'
        },
        annotations: {
            alwaysOutside: true,
            textStyle: {
                fontSize: 12,
                color: '#000',
                auraColor: 'none'
            }
        },
        isStacked: false
    };

    let dataColumnIndex = 1;
    jenisPajakToShow.forEach(() => {
        const formatter = new google.visualization.NumberFormat({
            prefix: 'Rp ',
            groupingUsed: true,
            fractionDigits: 0
        });
        if (showRealisasiArea) {
            formatter.format(dataTable, dataColumnIndex);
            dataColumnIndex += 2;
        }
        if (showTargetArea) {
            formatter.format(dataTable, dataColumnIndex);
            dataColumnIndex += 2;
        }
    });

    const chart = new google.visualization.AreaChart(document.getElementById('jenisPajakChart'));

    chart.draw(dataTable, options);

    window.addEventListener('resize', function () {
        chart.draw(dataTable, options);
    });
}

// Fungsi untuk menggambar atau memperbarui Bar Chart Perubahan Realisasi (Google Charts)
function drawDifferenceBarChartGoogle(firebaseData, selectedYear) {
    const dataTable = new google.visualization.DataTable();
    dataTable.addColumn('string', 'Jenis Pajak');
    dataTable.addColumn('number', 'Perubahan (%)');
    dataTable.addColumn({ type: 'string', role: 'style' }); // Untuk warna bar
    dataTable.addColumn({ type: 'string', role: 'tooltip', p: {'html': true} }); // Untuk tooltip kustom (HTML)
    dataTable.addColumn({ type: 'string', role: 'annotation' }); // Untuk label persentase di bar

    const chartData = [];
    Object.values(firebaseData).forEach(item => {
        const currentYearData = item[selectedYear];
        const previousYear = parseInt(selectedYear) - 1;
        let realisasiPrevious = 0;

        // Penanganan khusus untuk tahun 2020 (menggunakan data Realisasi_Tahun_Sebelumnya dari 2020 sebagai 2019)
        if (selectedYear === '2020') {
            realisasiPrevious = parseNumeric(item[2020]?.Realisasi_Tahun_Sebelumnya || 0);
        } else {
            const previousYearData = item[previousYear];
            realisasiPrevious = parseNumeric(previousYearData?.Realisasi_sd_Tahun || 0);
        }

        if (currentYearData) { // Pastikan data tahun sekarang ada
            const realisasiCurrent = parseNumeric(currentYearData.Realisasi_sd_Tahun || 0);
            const difference = realisasiCurrent - realisasiPrevious;
            const zoneColor = difference >= 0 ? '#10B981' : '#EF4444'; // Hijau atau Merah

            let percentageChange = 0;
            if (realisasiPrevious !== 0) {
                percentageChange = (difference / realisasiPrevious) * 100;
            } else if (realisasiCurrent !== 0) {
                // Jika realisasiPrevious 0 dan realisasiCurrent ada, anggap kenaikan tak terhingga atau sangat besar
                // Untuk tujuan visualisasi, kita bisa beri nilai sangat besar atau 100% jika ingin menampilkan
                // Di sini, kita akan membiarkan 0% jika realisasiPrevious 0, untuk menjaga skala.
                // Jika ingin menunjukkan pertumbuhan besar, bisa diatur ke nilai default tinggi, misal 1000%
                percentageChange = 0; // Atau nilai lain yang Anda inginkan untuk kasus ini
            }

            // Tooltip text
            const tooltipText = `
                <div>
                    <strong>${item.Jenis_Pajak}</strong><br/>
                    Realisasi Tahun Sebelumnya: ${formatRupiah(realisasiPrevious)}<br/>
                    Realisasi Tahun Sekarang: ${formatRupiah(realisasiCurrent)}<br/>
                    ${difference >= 0 ? "Kelebihan" : "Kekurangan"}: ${formatRupiah(Math.abs(difference))}<br/>
                    Perubahan: ${percentageChange.toFixed(2)}%
                </div>
            `;

            chartData.push([
                item.Jenis_Pajak,
                Math.abs(percentageChange), // Gunakan nilai absolut untuk tinggi bar
                zoneColor,
                tooltipText,
                `${percentageChange.toFixed(2)}%` // Label di atas bar
            ]);
        }
    });

    dataTable.addRows(chartData);

    const options = {
        title: `Perubahan Realisasi Pajak Daerah (${selectedYear} vs ${parseInt(selectedYear) - 1})`,
        titleTextStyle: {
            color: '#333',
            fontSize: 16
        },
        legend: { position: 'none' }, // Legenda sudah ada di HTML
        backgroundColor: '#ffffff',
        chartArea: { width: '80%', height: '70%' },
        hAxis: {
            title: 'Jenis Pajak',
            titleTextStyle: { color: '#555', fontSize: 14 },
            textStyle: { color: '#555' },
            slantedText: true, // Miringkan teks label
            slantedTextAngle: 45 // Sudut kemiringan
        },
        vAxis: {
            title: 'Besar Perubahan (%)',
            titleTextStyle: { color: '#555', fontSize: 14 },
            format: '#\'%\'', // Format sebagai persentase
            gridlines: { color: '#eee' },
            textStyle: { color: '#555' },
            viewWindow: {
                min: 0,
                max: globalMaxAbsPercentageChange // Stabilkan sumbu Y
            },
        },
        bar: { groupWidth: '80%' },
        tooltip: { isHtml: true }, // Menggunakan HTML tooltip untuk format yang lebih baik
        annotations: {
            alwaysOutside: true,
            textStyle: {
                fontSize: 12,
                color: '#000',
                auraColor: 'none'
            }
        }
    };

    const chart = new google.visualization.ColumnChart(document.getElementById('differenceBarChart'));
    chart.draw(dataTable, options);

    window.addEventListener('resize', function () {
        chart.draw(dataTable, options);
    });
}


// Fungsi parseNumeric
const parseNumeric = (value) => {
    // Pastikan nilai adalah string sebelum melakukan replace
    if (typeof value === 'string') {
        // Hapus titik sebagai pemisah ribuan dan ganti koma dengan titik untuk desimal
        return parseFloat(value.replace(/\./g, '').replace(/,/g, '.'));
    }
    return value; // Jika bukan string, kembalikan nilai aslinya
};

// Fungsi untuk mengisi tabel berdasarkan tahun
function populateTable(year, data) {
    const tbody = document.querySelector(`#pajakTable${year} tbody`);
    if (!tbody) {
        console.warn(`Tbody for table pajakTable${year} not found.`);
        return;
    }
    tbody.innerHTML = ""; // Bersihkan tabel sebelum mengisi ulang

    let totalTarget = 0;
    let totalRealisasi = 0;
    let totalRealisasiPrevYearAccumulated = 0;
    let rowCount = 0;

    Object.values(data).forEach((item, index) => {
        const yearData = item[year];

        if (!yearData) {
            return;
        }

        const jenisPajak = item["Jenis_Pajak"] || "N/A";
        const target = parseNumeric(yearData.Target || 0);
        const realisasi = parseNumeric(yearData.Realisasi_sd_Tahun || 0);
        const realisasiPrevYear = parseNumeric(yearData.Realisasi_Tahun_Sebelumnya || 0);

        const persentase = (target !== 0) ? (realisasi / target) * 100 : 0;
        const selisih = target - realisasi;
        const kenaikan = realisasi - realisasiPrevYear;
        const kenaikanPersen = (realisasiPrevYear !== 0) ? (kenaikan / realisasiPrevYear) * 100 : 0;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="pajak-app-left">${jenisPajak}</td>
            <td>${formatRupiah(target)}</td>
            <td>${formatRupiah(realisasi)}</td>
            <td>${formatRupiah(selisih)}</td>
            <td>${formatPersentase(persentase)}</td>
            <td>${formatRupiah(realisasiPrevYear)}</td>
            <td>${formatRupiah(kenaikan)}</td>
            <td>${formatPersentase(kenaikanPersen)}</td>
        `;
        tbody.appendChild(row);

        totalTarget += target;
        totalRealisasi += realisasi;
        totalRealisasiPrevYearAccumulated += realisasiPrevYear;
        rowCount++;
    });

    const totalPersentaseRealisasi = (totalTarget !== 0) ? (totalRealisasi / totalTarget) * 100 : 0;
    const totalKenaikan = totalRealisasi - totalRealisasiPrevYearAccumulated;
    const totalKenaikanPersen = (totalRealisasiPrevYearAccumulated !== 0) ? (totalKenaikan / totalRealisasiPrevYearAccumulated) * 100 : 0;
    const totalSelisihFooter = totalTarget - totalRealisasi;

    document.getElementById(`totalTarget${year}`).textContent = formatRupiah(totalTarget);
    document.getElementById(`totalRealisasi${year}`).textContent = formatRupiah(totalRealisasi);
    document.getElementById(`totalSelisih${year}`).textContent = formatRupiah(totalSelisihFooter);
    document.getElementById(`totalPersentase${year}`).textContent = formatPersentase(totalPersentaseRealisasi);

    const prevYearForCurrentTableId = `totalRealisasi${year - 1}_for${year}`;
    const prevYearForCurrentTableElem = document.getElementById(prevYearForCurrentTableId);
    if (prevYearForCurrentTableElem) {
        prevYearForCurrentTableElem.textContent = formatRupiah(totalRealisasiPrevYearAccumulated);
    } else {
        console.warn(`Element with ID '${prevYearForCurrentTableId}' not found.`);
    }

    document.getElementById(`totalKenaikan${year}`).textContent = formatRupiah(totalKenaikan);
    document.getElementById(`totalKenaikanPersen${year}`).textContent = formatPersentase(totalKenaikanPersen);

    if (year === 2025) {
        const totalRealisasiElem = document.getElementById("totalRealisasiCounter");
        if (totalRealisasiElem) {
            const current = Number(totalRealisasiElem.dataset.lastValue || 0);
            animateNumber(totalRealisasiElem, current, totalRealisasi, 1000);
            totalRealisasiElem.dataset.lastValue = totalRealisasi;

            totalRealisasiElem.classList.add("pajak-app-highlight-anim");
            setTimeout(() => {
                totalRealisasiElem.classList.remove("pajak-app-highlight-anim");
            }, 1000);
        }
        document.getElementById("jumlahJenisPajak").textContent = `${rowCount} Jenis Pajak`;
    }
}

// Fungsi untuk menampilkan tabel berdasarkan tahun yang dipilih
function displayTableForYear(selectedYear) {
    console.log(`Menampilkan tabel untuk tahun: ${selectedYear}`);
    const allTableWrappers = document.querySelectorAll('.pajak-app-table-wrapper');
    allTableWrappers.forEach(wrapper => {
        wrapper.classList.add('hidden');
        console.log(`Menyembunyikan: ${wrapper.id}`);
    });

    const selectedTableWrapper = document.getElementById(`tableWrapper${selectedYear}`);
    if (selectedTableWrapper) {
        selectedTableWrapper.classList.remove('hidden');
        console.log(`Menampilkan: ${selectedTableWrapper.id}`);
        if (allFirebaseData) {
            populateTable(parseInt(selectedYear), allFirebaseData);
        }
    } else {
        console.warn(`Wrapper tabel untuk tahun ${selectedYear} tidak ditemukan.`);
    }
}

// Fungsi untuk menghitung rentang persentase perubahan absolut maksimum secara global
function calculateGlobalAbsPercentageChangeRange(firebaseData) {
    let maxAbsPercentageChange = 0;

    // Iterasi melalui semua kemungkinan tahun perbandingan (2020 vs 2019 hingga 2025 vs 2024)
    for (let currentYear = 2020; currentYear <= 2025; currentYear++) {
        Object.values(firebaseData).forEach(item => {
            const currentYearData = item[currentYear];
            let realisasiPrevious = 0;

            // Penanganan data tahun sebelumnya (2019 untuk 2020, atau Realisasi_sd_Tahun dari tahun sebelumnya)
            if (currentYear === 2020) {
                realisasiPrevious = parseNumeric(item[2020]?.Realisasi_Tahun_Sebelumnya || 0);
            } else {
                const previousYearData = item[currentYear - 1];
                realisasiPrevious = parseNumeric(previousYearData?.Realisasi_sd_Tahun || 0);
            }

            if (currentYearData) { // Pastikan data tahun sekarang ada
                const realisasiCurrent = parseNumeric(currentYearData.Realisasi_sd_Tahun || 0);

                if (realisasiPrevious !== 0) {
                    const difference = realisasiCurrent - realisasiPrevious;
                    const percentageChange = (difference / realisasiPrevious) * 100;
                    const absPercentageChange = Math.abs(percentageChange);

                    if (absPercentageChange > maxAbsPercentageChange) {
                        maxAbsPercentageChange = absPercentageChange;
                    }
                } else if (realisasiCurrent !== 0) {
                    // Jika realisasiPrevious adalah 0 dan realisasiCurrent bukan 0,
                    // ini adalah kenaikan dari nol. Kita bisa menganggapnya sebagai 100%
                    // atau nilai yang sangat tinggi untuk visualisasi.
                    // Untuk menjaga skala stabil, kita bisa menetapkan nilai default tinggi
                    // atau mengabaikannya dari perhitungan maxAbsPercentageChange jika tidak ingin
                    // bar ini mendominasi skala. Untuk saat ini, kita akan mengabaikannya
                    // dari perhitungan maxAbsPercentageChange agar tidak membuat skala terlalu besar.
                }
            }
        });
    }
    // Tambahkan sedikit buffer ke nilai maksimum untuk tampilan yang lebih baik
    globalMaxAbsPercentageChange = maxAbsPercentageChange * 1.1;
    // Pastikan tidak nol jika semua perubahan adalah nol atau diabaikan
    if (globalMaxAbsPercentageChange === 0) {
        globalMaxAbsPercentageChange = 100; // Default ke 100% jika tidak ada perubahan terdeteksi
    }
    console.log(`Global Max Absolute Percentage Change: ${globalMaxAbsPercentageChange}`);
}


// Fungsi untuk mendengarkan data Firebase setelah Google Charts dimuat
function listenForFirebaseData() {
    onValue(dbRef, (snapshot) => {
        if (snapshot.exists()) {
            allFirebaseData = snapshot.val();
            console.log("Data diterima dari Firebase:", allFirebaseData);

            // Hitung rentang persentase perubahan absolut maksimum secara global
            calculateGlobalAbsPercentageChangeRange(allFirebaseData);

            // Inisialisasi dan event listener untuk Overall Bar Chart
            const showRealisasiOverallCheckbox = document.getElementById('showRealisasiOverall');
            const showTargetOverallCheckbox = document.getElementById('showTargetOverall');
            if (showRealisasiOverallCheckbox && showTargetOverallCheckbox) {
                if (!showRealisasiOverallCheckbox.dataset.listenerAdded) {
                    showRealisasiOverallCheckbox.addEventListener('change', () => drawRealisasiChart(allFirebaseData));
                    showRealisasiOverallCheckbox.dataset.listenerAdded = 'true';
                }
                if (!showTargetOverallCheckbox.dataset.listenerAdded) {
                    showTargetOverallCheckbox.addEventListener('change', () => drawRealisasiChart(allFirebaseData));
                    showTargetOverallCheckbox.dataset.listenerAdded = 'true';
                }
            }
            drawRealisasiChart(allFirebaseData); // Panggilan awal

            // Populate Jenis Pajak dropdown (Area Chart)
            const jenisPajakSelector = document.getElementById('jenisPajakSelector');
            if (jenisPajakSelector) {
                jenisPajakSelector.innerHTML = '<option value="All">Semua Jenis Pajak</option>';
                Object.keys(allFirebaseData).forEach(key => {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = allFirebaseData[key].Jenis_Pajak;
                    jenisPajakSelector.appendChild(option);
                });

                // Tambahkan event listener untuk dropdown jenis pajak (Area Chart)
                if (!jenisPajakSelector.dataset.listenerAdded) {
                    jenisPajakSelector.addEventListener('change', (event) => {
                        const newSelectedJenisPajak = event.target.value;
                        drawJenisPajakChart(allFirebaseData, newSelectedJenisPajak);
                    });
                    jenisPajakSelector.dataset.listenerAdded = 'true';
                }
            }

            // Tambahkan event listener untuk checkbox Realisasi dan Target (Area Chart)
            const showRealisasiAreaCheckbox = document.getElementById('showRealisasiArea');
            const showTargetAreaCheckbox = document.getElementById('showTargetArea');

            if (showRealisasiAreaCheckbox && showTargetAreaCheckbox) {
                if (!showRealisasiAreaCheckbox.dataset.listenerAdded) {
                    showRealisasiAreaCheckbox.addEventListener('change', () => {
                        const selectedJenisPajak = jenisPajakSelector ? jenisPajakSelector.value : 'All';
                        drawJenisPajakChart(allFirebaseData, selectedJenisPajak);
                    });
                    showRealisasiAreaCheckbox.dataset.listenerAdded = 'true';
                }
                if (!showTargetAreaCheckbox.dataset.listenerAdded) {
                    showTargetAreaCheckbox.addEventListener('change', () => {
                        const selectedJenisPajak = jenisPajakSelector ? jenisPajakSelector.value : 'All';
                        drawJenisPajakChart(allFirebaseData, selectedJenisPajak);
                    });
                    showTargetAreaCheckbox.dataset.listenerAdded = 'true';
                }
            }
            drawJenisPajakChart(allFirebaseData, jenisPajakSelector ? jenisPajakSelector.value : 'All'); // Panggilan awal


            // Google Charts Bar Chart Perubahan Realisasi Logic
            const barChartYearSelector = document.getElementById('barChartYearSelector');
            if (barChartYearSelector) {
                barChartYearSelector.value = '2025'; // Default to 2025
                // Tambahkan event listener untuk dropdown tahun Bar Chart Perubahan
                if (!barChartYearSelector.dataset.listenerAdded) {
                    barChartYearSelector.addEventListener('change', (event) => {
                        const newSelectedYear = event.target.value;
                        drawDifferenceBarChartGoogle(allFirebaseData, newSelectedYear);
                    });
                    barChartYearSelector.dataset.listenerAdded = 'true';
                }
            }
            // Panggilan awal untuk Google Charts Bar Chart Perubahan
            drawDifferenceBarChartGoogle(allFirebaseData, barChartYearSelector ? barChartYearSelector.value : '2025');
            window.addEventListener('resize', () => drawDifferenceBarChartGoogle(allFirebaseData, barChartYearSelector ? barChartYearSelector.value : '2025'));


            const yearSelector = document.getElementById('yearSelector');
            const currentSelectedYear = yearSelector ? yearSelector.value : '2025';

            displayTableForYear(currentSelectedYear);

            if (yearSelector) {
                if (!yearSelector.dataset.listenerAdded) {
                    yearSelector.addEventListener('change', (event) => {
                        const newSelectedYear = event.target.value;
                        displayTableForYear(newSelectedYear);
                    });
                    yearSelector.dataset.listenerAdded = 'true';
                }
            }

        } else {
            console.log("No data available at the specified Firebase path.");
            const totalOverallChartDataElem = document.getElementById('totalRealisasiOverallChartData');
            if (totalOverallChartDataElem) totalOverallChartDataElem.textContent = formatRupiah(0);

            const realisasiChartElem = document.getElementById('realisasiChart');
            if (realisasiChartElem) realisasiChartElem.innerHTML = '<p style="text-align: center; color: #555;">Tidak ada data grafik.</p>';

            const jenisPajakChartElem = document.getElementById('jenisPajakChart');
            if (jenisPajakChartElem) jenisPajakChartElem.innerHTML = '<p style="text-align: center; color: #555;">Tidak ada data grafik.</p>';

            const differenceBarChartElem = document.getElementById('differenceBarChart');
            if (differenceBarChartElem) differenceBarChartElem.innerHTML = '<p style="text-align: center; color: #555;">Tidak ada data grafik.</p>';


            for (let year = 2020; year <= 2025; year++) {
                const tbody = document.querySelector(`#pajakTable${year} tbody`);
                if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Tidak ada data untuk tahun ini.</td></tr>';

                document.getElementById(`totalTarget${year}`).textContent = formatRupiah(0);
                document.getElementById(`totalRealisasi${year}`).textContent = formatRupiah(0);
                document.getElementById(`totalSelisih${year}`).textContent = formatRupiah(0);
                document.getElementById(`totalPersentase${year}`).textContent = formatPersentase(0);
                const prevYearForCurrentTableId = `totalRealisasi${year - 1}_for${year}`;
                const prevYearElem = document.getElementById(prevYearForCurrentTableId);
                if (prevYearElem) prevYearElem.textContent = formatRupiah(0);
                document.getElementById(`totalKenaikan${year}`).textContent = formatRupiah(0);
                document.getElementById(`totalKenaikanPersen${year}`).textContent = formatPersentase(0);
            }
            const totalRealisasiElem = document.getElementById("totalRealisasiCounter");
            if (totalRealisasiElem) totalRealisasiElem.textContent = formatRupiah(0);
            const jumlahJenisPajakElem = document.getElementById("jumlahJenisPajak");
            if (jumlahJenisPajakElem) jumlahJenisPajakElem.textContent = `0 Jenis Pajak`;

            const allTableWrappers = document.querySelectorAll('.pajak-app-table-wrapper');
            allTableWrappers.forEach(wrapper => {
                wrapper.classList.add('hidden');
            });
        }
    }, (error) => {
        console.error("Firebase read failed:", error);
        if (error.code === "PERMISSION_DENIED") {
            console.error("Pastikan aturan keamanan Firebase Anda mengizinkan akses baca ('.read': 'true').");
        }
    });
}