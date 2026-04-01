const { createApp, ref, computed, reactive, onMounted, watch } = Vue;
createApp({
    setup() {
        const currentTab = ref('itinerary');
        const selectedDate = ref('2026-04-02');
        const calcKrw = ref(null);
        const exchangeRate = ref(0.024);

        // 匯率換算頁：選擇的回饋卡
        const calcCardMode = ref('esun'); // 'esun' | 'ctbc_general' | 'ctbc_special' | 'custom'
        const calcCustomRate = ref(3);    // 自訂%數

        // 計算刷卡後金額（含1.5%手續費）
        const calcCardAmount = computed(() => {
            if (!calcKrw.value) return 0;
            return Math.round(calcKrw.value * exchangeRate.value * 1.015);
        });

        // 計算回饋金額
        const calcReward = computed(() => {
            const amt = calcCardAmount.value;
            if (!amt) return 0;
            let rate = 0;
            if (calcCardMode.value === 'esun') rate = 0.045;
            else if (calcCardMode.value === 'ctbc_general') rate = 0.028;
            else if (calcCardMode.value === 'ctbc_special') rate = 0.10;
            else if (calcCardMode.value === 'custom') rate = (calcCustomRate.value || 0) / 100;
            return Math.round(amt * rate);
        });

        const STORAGE_KEYS = {
            ITINERARY: 'korea_trip_itinerary_v2',
            SHOPPING: 'korea_trip_shopping_v1',
            EXPENSES: 'korea_trip_expenses_v1',
            SPLIT: 'korea_trip_split_v1'
        };

        const weatherList = ref([
            { city: '首爾', lat: 37.5665, lon: 126.9780, temp: '-', feel: '-', icon: 'fa-solid fa-spinner fa-spin' },
            { city: '釜山', lat: 35.1796, lon: 129.0756, temp: '-', feel: '-', icon: 'fa-solid fa-spinner fa-spin' }
        ]);

        const getWeather = async () => {
            for (let weather of weatherList.value) {
                try {
                    const response = await fetch(
                        `https://api.open-meteo.com/v1/forecast?latitude=${weather.lat}&longitude=${weather.lon}&current=temperature_2m,apparent_temperature,weather_code&timezone=Asia%2FSeoul&forecast_days=1&models=best_match`
                    );
                    const data = await response.json();
                    weather.temp = Math.round(data.current.temperature_2m);
                    weather.feel = Math.round(data.current.apparent_temperature);
                    const code = data.current.weather_code;
                    if (code === 0) weather.icon = 'fa-solid fa-sun text-yellow-400';
                    else if (code <= 3) weather.icon = 'fa-solid fa-cloud-sun text-slate-400';
                    else if (code <= 67) weather.icon = 'fa-solid fa-cloud-rain text-ice-500';
                    else if (code <= 77) weather.icon = 'fa-regular fa-snowflake text-ice-300';
                    else weather.icon = 'fa-solid fa-cloud text-slate-400';
                } catch (error) {
                    console.error(`${weather.city}天氣失敗`, error);
                }
            }
        };

        const getExchangeRate = async () => {
            try {
                const response = await fetch('https://api.exchangerate-api.com/v4/latest/KRW');
                const data = await response.json();
                if (data?.rates?.TWD) exchangeRate.value = data.rates.TWD;
            } catch (error) { console.error("匯率失敗", error); }
        };

        const dates = reactive([
            { full: '2026-04-02', day: '週四', date: '02' },
            { full: '2026-04-03', day: '週五', date: '03' },
            { full: '2026-04-04', day: '週六', date: '04' },
            { full: '2026-04-05', day: '週日', date: '05' },
            { full: '2026-04-06', day: '週一', date: '06' },
        ]);

        const getFormattedDate = (dateObj) => {
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const fullDate = `${yyyy}-${mm}-${dd}`;
            const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
            return { full: fullDate, day: days[dateObj.getDay()], date: dd };
        };

        const addNextDate = () => {
            const currentIdx = dates.findIndex(d => d.full === selectedDate.value);
            if (currentIdx < dates.length - 1) { selectedDate.value = dates[currentIdx + 1].full; return; }
            const nextDate = new Date(dates[dates.length - 1].full);
            nextDate.setDate(nextDate.getDate() + 1);
            const newDate = getFormattedDate(nextDate);
            dates.push(newDate);
            if (!itineraryData[newDate.full]) itineraryData[newDate.full] = [];
            selectedDate.value = newDate.full;
            setTimeout(() => { const c = document.querySelector('.date-scroll'); if (c) c.scrollLeft = c.scrollWidth; }, 100);
        };

        const addPrevDate = () => {
            const currentIdx = dates.findIndex(d => d.full === selectedDate.value);
            if (currentIdx > 0) { selectedDate.value = dates[currentIdx - 1].full; return; }
            const prevDate = new Date(dates[0].full);
            prevDate.setDate(prevDate.getDate() - 1);
            const newDate = getFormattedDate(prevDate);
            dates.unshift(newDate);
            if (!itineraryData[newDate.full]) itineraryData[newDate.full] = [];
            selectedDate.value = newDate.full;
            setTimeout(() => { const c = document.querySelector('.date-scroll'); if (c) c.scrollLeft = 0; }, 100);
        };

        const deleteDate = (targetFull) => {
            if (dates.length <= 1) { alert("至少需要保留一天行程！"); return; }
            if (!confirm(`確定要刪除 ${targetFull} 及其所有行程嗎？`)) return;
            const idx = dates.findIndex(d => d.full === targetFull);
            if (idx === -1) return;
            dates.splice(idx, 1);
            delete itineraryData[targetFull];
            selectedDate.value = dates[Math.min(idx, dates.length - 1)].full;
        };

        const hotelList = reactive(JSON.parse(localStorage.getItem('my_hotels')) || [
            { id: 1, name: '首爾飯店範本', address: '首爾特別市鐘路區...', phone: '+8221234567' }
        ]);
        const showHotelModal = ref(false);
        const hotelForm = reactive({ name: '', address: '', phone: '' });

        const saveHotel = () => {
            if (!hotelForm.name || !hotelForm.address) return alert('請填寫飯店名稱與地址');
            hotelList.push({ id: Date.now(), ...hotelForm });
            localStorage.setItem('my_hotels', JSON.stringify(hotelList));
            Object.assign(hotelForm, { name: '', address: '', phone: '' });
            showHotelModal.value = false;
        };

        const deleteHotel = (id) => {
            const index = hotelList.findIndex(h => h.id === id);
            if (index !== -1 && confirm('確定要刪除這間飯店嗎？')) {
                hotelList.splice(index, 1);
                localStorage.setItem('my_hotels', JSON.stringify(hotelList));
            }
        };

        const defaultItinerary = {
            '2026-04-02': [], '2026-04-03': [], '2026-04-04': [],
            '2026-04-05': [], '2026-04-06': []
        };
        const itineraryData = reactive({ ...defaultItinerary });
        const shoppingList = reactive([]);
        const expenses = reactive([]);

        const shoppingViewMode = ref('grid');
        const showShopPreview = ref(false);
        const previewItem = reactive({ name: '', image: null });
        const openShopPreview = (item) => {
            previewItem.name = item.name;
            previewItem.image = item.image;
            showShopPreview.value = true;
        };

        const splitSettings = reactive(
            JSON.parse(localStorage.getItem(STORAGE_KEYS.SPLIT)) || { person1: '旅伴1', person2: '旅伴2' }
        );
        const editingSplitNames = ref(false);
        watch(splitSettings, (v) => localStorage.setItem(STORAGE_KEYS.SPLIT, JSON.stringify(v)), { deep: true });

        const expandedItems = reactive({});
        const toggleExpand = (id) => { expandedItems[id] = !expandedItems[id]; };

        const loadSavedData = () => {
            const savedItinerary = localStorage.getItem(STORAGE_KEYS.ITINERARY);
            if (savedItinerary) {
                try {
                    const parsed = JSON.parse(savedItinerary);
                    for (const key in itineraryData) delete itineraryData[key];
                    Object.assign(itineraryData, parsed);
                } catch (e) {}
            }
            const savedShopping = localStorage.getItem(STORAGE_KEYS.SHOPPING);
            if (savedShopping) {
                try { shoppingList.splice(0, shoppingList.length, ...JSON.parse(savedShopping)); } catch (e) {}
            }
            const savedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
            if (savedExpenses) {
                try { expenses.splice(0, expenses.length, ...JSON.parse(savedExpenses)); } catch (e) {}
            }
        };

        watch(itineraryData, (v) => localStorage.setItem(STORAGE_KEYS.ITINERARY, JSON.stringify(v)), { deep: true });
        watch(shoppingList, (v) => localStorage.setItem(STORAGE_KEYS.SHOPPING, JSON.stringify(v)), { deep: true });
        watch(expenses, (v) => localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(v)), { deep: true });

        const setAppHeight = () => {
            document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
            const safe = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)') || '0');
            document.documentElement.style.setProperty('--safe-bottom', `${Math.max(safe, 16)}px`);
        };

        onMounted(() => {
            loadSavedData(); getWeather(); getExchangeRate(); setAppHeight();
            window.addEventListener('resize', setAppHeight);
            window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 100));
        });

        const showModal = ref(false);
        const isEditing = ref(false);
        const form = reactive({
            id: null, name: '', time: '', category: '景點', note: '', transportMode: 'walk',
            flight: { from: '', fromTerminal: '', dep: '', to: '', toTerminal: '', arr: '', no: '' }
        });

        const showShopModal = ref(false);
        const shopForm = reactive({ index: -1, name: '', image: null });
        const showExpenseModal = ref(false);

        const expenseForm = reactive({
            id: null, date: '2026-04-02', name: '', amount: '',
            category: '飲食', payment: '現金', currency: 'KRW', ctbcRate: '2.8',
            splitEnabled: false, splitMode: 'both',
            splitP1: true, splitP2: true, splitP1Pct: 50, splitP2Pct: 50
        });

        watch(() => expenseForm.splitP1Pct, (v) => { expenseForm.splitP2Pct = 100 - v; });
        watch(() => expenseForm.currency, (newVal) => {
            if (newVal === 'TWD' && (expenseForm.payment === '玉山Unicard' || expenseForm.payment === '中信LinePay')) {
                expenseForm.payment = '信用卡';
            }
        });
        watch(() => expenseForm.splitMode, (v) => {
            if (v === 'both') { expenseForm.splitP1 = true; expenseForm.splitP2 = true; }
            else if (v === 'p1only') { expenseForm.splitP1 = true; expenseForm.splitP2 = false; }
            else if (v === 'p2only') { expenseForm.splitP1 = false; expenseForm.splitP2 = true; }
        });

        const currentItinerary = computed(() => itineraryData[selectedDate.value] || []);

        const expensesStats = computed(() => {
            let totalKRW = 0, totalTWD = 0;
            expenses.forEach(item => {
                const val = parseInt(item.amount || 0);
                if (item.currency === 'TWD') { totalTWD += val; totalKRW += val / exchangeRate.value; }
                else { totalKRW += val; totalTWD += val * exchangeRate.value; }
            });
            return { krw: Math.round(totalKRW), twd: Math.round(totalTWD) };
        });

        const esunStats = computed(() => {
            const list = expenses.filter(e => e.payment === '玉山Unicard');
            const spent = Math.round(list.reduce((sum, item) => {
                return sum + (item.currency === 'TWD' ? parseInt(item.amount || 0) : parseInt(item.amount || 0) * exchangeRate.value * 1.015);
            }, 0));
            return { spent, reward: Math.round(spent * 0.045) };
        });

        const ctbcStats = computed(() => {
            const list = expenses.filter(e => e.payment === '中信LinePay');
            const spent = Math.round(list.reduce((sum, item) => {
                return sum + (item.currency === 'TWD' ? parseInt(item.amount || 0) : parseInt(item.amount || 0) * exchangeRate.value * 1.015);
            }, 0));
            const reward = Math.round(
                list.filter(e => e.ctbcRate !== '10').reduce((s, i) => s + (i.currency === 'TWD' ? parseInt(i.amount || 0) : parseInt(i.amount || 0) * exchangeRate.value * 1.015), 0) * 0.028 +
                list.filter(e => e.ctbcRate === '10').reduce((s, i) => s + (i.currency === 'TWD' ? parseInt(i.amount || 0) : parseInt(i.amount || 0) * exchangeRate.value * 1.015), 0) * 0.10
            );
            return { spent, reward };
        });

        const splitStats = computed(() => {
            let p1Total = 0, p2Total = 0;
            expenses.forEach(item => {
                if (!item.splitEnabled) return;
                const amtTWD = item.currency === 'TWD' ? parseInt(item.amount || 0) : parseInt(item.amount || 0) * exchangeRate.value;
                const mode = item.splitMode || 'both';
                if (mode === 'both') {
                    p1Total += amtTWD * ((item.splitP1Pct || 50) / 100);
                    p2Total += amtTWD * ((item.splitP2Pct || 50) / 100);
                } else if (mode === 'p1only') { p1Total += amtTWD; }
                else if (mode === 'p2only') { p2Total += amtTWD; }
            });
            p1Total = Math.round(p1Total); p2Total = Math.round(p2Total);
            const diff = Math.abs(p1Total - p2Total);
            const settlement = diff > 0
                ? (p1Total > p2Total
                    ? `${splitSettings.person2} 需付 ${splitSettings.person1} NT$${diff.toLocaleString()}`
                    : `${splitSettings.person1} 需付 ${splitSettings.person2} NT$${diff.toLocaleString()}`)
                : '帳目已平！';
            return { p1Total, p2Total, settlement };
        });

        const getCategoryIcon = (c) => {
            const map = { '景點': 'fa-camera', '住宿': 'fa-bed', '美食': 'fa-utensils', '購物': 'fa-bag-shopping', '交通': 'fa-train', '其他': 'fa-star', '航班': 'fa-plane' };
            return `fa-solid ${map[c] || 'fa-circle'}`;
        };

        const openMap = (k) => k && window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(k)}`, '_blank');

        const openAddModal = () => {
            isEditing.value = false;
            Object.assign(form, {
                id: Date.now(), name: '', time: '', category: '景點', note: '', transportMode: 'walk',
                flight: { from: '', fromTerminal: '', dep: '', to: '', toTerminal: '', arr: '', no: '' }
            });
            showModal.value = true;
        };

        const editItem = (item) => {
            isEditing.value = true;
            Object.assign(form, {
                ...item,
                flight: item.flight
                    ? { from: '', fromTerminal: '', dep: '', to: '', toTerminal: '', arr: '', no: '', ...item.flight }
                    : { from: '', fromTerminal: '', dep: '', to: '', toTerminal: '', arr: '', no: '' }
            });
            showModal.value = true;
        };

        const saveItem = () => {
            if (!itineraryData[selectedDate.value]) itineraryData[selectedDate.value] = [];
            const list = itineraryData[selectedDate.value];
            const saveData = { ...form, flight: form.category === '航班' ? { ...form.flight } : undefined };
            if (isEditing.value) {
                const idx = list.findIndex(i => i.id === form.id);
                if (idx !== -1) list[idx] = saveData;
            } else { list.push(saveData); }
            list.sort((a, b) => a.time.localeCompare(b.time));
            showModal.value = false;
        };

        const deleteItem = () => {
            if (confirm('刪除？')) {
                const idx = itineraryData[selectedDate.value].findIndex(i => i.id === form.id);
                if (idx !== -1) itineraryData[selectedDate.value].splice(idx, 1);
                showModal.value = false;
            }
        };

        const closeModal = () => showModal.value = false;

        let dragStartIndex = null;
        const dragStart = (i) => dragStartIndex = i;
        const drop = (i) => {
            const list = itineraryData[selectedDate.value];
            const item = list.splice(dragStartIndex, 1)[0];
            list.splice(i, 0, item);
            dragStartIndex = null;
        };

        const openShopModal = (item = null, idx = -1) => {
            shopForm.index = idx;
            shopForm.name = item ? item.name : '';
            shopForm.image = item ? item.image : null;
            showShopModal.value = true;
        };

        const saveShopItem = () => {
            if (shopForm.name) {
                if (shopForm.index > -1) shoppingList[shopForm.index] = { name: shopForm.name, image: shopForm.image };
                else shoppingList.push({ name: shopForm.name, image: shopForm.image });
                showShopModal.value = false;
            }
        };

        const removeShoppingItem = (i) => { if (confirm('刪除？')) shoppingList.splice(i, 1); };

        const compressImage = (file, maxWidth = 400, quality = 0.7) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });

        const handleImageUpload = async (e) => {
            const file = e.target.files[0];
            if (file) { try { shopForm.image = await compressImage(file); } catch (err) { console.error(err); } }
        };

        const openExpenseModal = (item = null) => {
            if (item) {
                const mode = item.splitMode || (item.splitP1 && item.splitP2 ? 'both' : item.splitP1 ? 'p1only' : 'p2only');
                Object.assign(expenseForm, {
                    ...item,
                    ctbcRate: item.ctbcRate || '2.8',
                    splitEnabled: item.splitEnabled || false,
                    splitMode: mode,
                    splitP1: item.splitP1 !== undefined ? item.splitP1 : true,
                    splitP2: item.splitP2 !== undefined ? item.splitP2 : true,
                    splitP1Pct: item.splitP1Pct || 50,
                    splitP2Pct: item.splitP2Pct || 50
                });
            } else {
                Object.assign(expenseForm, {
                    id: null, date: selectedDate.value, name: '', amount: '',
                    category: '飲食', payment: '現金', currency: 'KRW', ctbcRate: '2.8',
                    splitEnabled: false, splitMode: 'both',
                    splitP1: true, splitP2: true, splitP1Pct: 50, splitP2Pct: 50
                });
            }
            showExpenseModal.value = true;
        };

        const saveExpense = () => {
            if (expenseForm.amount) {
                const data = { ...expenseForm };
                if (expenseForm.id) {
                    const idx = expenses.findIndex(e => e.id === expenseForm.id);
                    if (idx !== -1) expenses[idx] = data;
                } else { expenses.unshift({ ...data, id: Date.now() }); }
                showExpenseModal.value = false;
            }
        };

        const deleteExpense = () => {
            if (confirm('確定要刪除此筆花費？')) {
                const idx = expenses.findIndex(e => e.id === expenseForm.id);
                if (idx !== -1) expenses.splice(idx, 1);
                showExpenseModal.value = false;
            }
        };

        const exportData = () => {
            const blob = new Blob([JSON.stringify({ itinerary: itineraryData, shopping: shoppingList, expenses })], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `韓國行程備份_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        };

        const importData = (event) => {
            const file = event.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (confirm('匯入將會覆蓋目前所有資料，確定嗎？')) {
                        if (parsed.itinerary) { for (const k in itineraryData) delete itineraryData[k]; Object.assign(itineraryData, parsed.itinerary); }
                        if (parsed.shopping) shoppingList.splice(0, shoppingList.length, ...parsed.shopping);
                        if (parsed.expenses) expenses.splice(0, expenses.length, ...parsed.expenses);
                        alert('匯入成功！');
                    }
                } catch (err) { alert('檔案格式錯誤，無法匯入。'); }
            };
            reader.readAsText(file); event.target.value = '';
        };

        return {
            currentTab, dates, selectedDate,
            hotelList, showHotelModal, hotelForm, saveHotel, deleteHotel,
            itineraryData, currentItinerary,
            expandedItems, toggleExpand,
            splitSettings, splitStats, editingSplitNames,
            shoppingList, expenses, expensesStats, esunStats, ctbcStats,
            shoppingViewMode, showShopPreview, previewItem, openShopPreview,
            calcKrw, exchangeRate, weatherList,
            calcCardMode, calcCustomRate, calcCardAmount, calcReward,
            getCategoryIcon, openMap,
            showModal, isEditing, form, openAddModal, editItem, saveItem, deleteItem, closeModal,
            dragStart, drop,
            showShopModal, shopForm, openShopModal, handleImageUpload, saveShopItem, removeShoppingItem,
            showExpenseModal, expenseForm, openExpenseModal, saveExpense, deleteExpense,
            exportData, importData,
            addNextDate, addPrevDate, deleteDate
        };
    }
}).mount('#app');
