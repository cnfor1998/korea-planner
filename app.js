const { createApp, ref, computed, reactive, onMounted, watch } = Vue;

createApp({
    setup() {
        const currentTab = ref('itinerary');
        const selectedDate = ref('2026-02-20');
        const calcJpy = ref(null);
        const exchangeRate = ref(0.206); 

        // --- Data storage Key ---
        const STORAGE_KEYS = {
            ITINERARY: 'osaka_trip_itinerary_v2',
            SHOPPING: 'osaka_trip_shopping_v1',
            EXPENSES: 'osaka_trip_expenses_v1'
        };

        const weatherInfo = reactive({
            temp: '-', feel: '-', icon: 'fa-solid fa-spinner fa-spin text-ice-300', text: '載入中'
        });

        // --- API Function ---
        const getWeather = async () => {
            try {
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=34.6937&longitude=135.5023&current=temperature_2m,apparent_temperature,weather_code&timezone=Asia%2FTokyo`);
                const data = await response.json();
                weatherInfo.temp = Math.round(data.current.temperature_2m);
                weatherInfo.feel = Math.round(data.current.apparent_temperature);
                const code = data.current.weather_code;
                if (code === 0) weatherInfo.icon = 'fa-solid fa-sun text-yellow-400';
                else if (code <= 3) weatherInfo.icon = 'fa-solid fa-cloud-sun text-slate-400';
                else if (code <= 67) weatherInfo.icon = 'fa-solid fa-cloud-rain text-ice-500';
                else if (code <= 77) weatherInfo.icon = 'fa-regular fa-snowflake text-ice-300';
                else weatherInfo.icon = 'fa-solid fa-cloud text-slate-400';
            } catch (error) { console.error("天氣失敗", error); }
        };

        const getExchangeRate = async () => {
            try {
                const response = await fetch('https://api.exchangerate-api.com/v4/latest/JPY');
                const data = await response.json();
                if (data?.rates?.TWD) exchangeRate.value = data.rates.TWD;
            } catch (error) { console.error("匯率失敗", error); }
        };

        const dates = reactive([
            { full: '2026-02-20', day: '週五', date: '20' },
            { full: '2026-02-21', day: '週六', date: '21' },
            { full: '2026-02-22', day: '週日', date: '22' },
            { full: '2026-02-23', day: '週一', date: '23' },
            { full: '2026-02-24', day: '週二', date: '24' }
        ]);

        //  Helper: Format date object
        const getFormattedDate = (dateObj) => {
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const fullDate = `${yyyy}-${mm}-${dd}`;
            const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
            const dayStr = days[dateObj.getDay()];
            return { full: fullDate, day: dayStr, date: dd };
        };

        //  Function: Add one day
        const addNextDate = () => {
            const lastDateObj = dates[dates.length - 1];
            const nextDate = new Date(lastDateObj.full);
            nextDate.setDate(nextDate.getDate() + 1);
            
            const newDate = getFormattedDate(nextDate);
            dates.push(newDate);

            if (!itineraryData[newDate.full]) itineraryData[newDate.full] = [];
            
            selectedDate.value = newDate.full;
            setTimeout(() => {
                const container = document.querySelector('.overflow-x-auto');
                if(container) container.scrollLeft = container.scrollWidth;
            }, 100);
        };

        // Function: Add one day forward
        const addPrevDate = () => {
            const firstDateObj = dates[0];
            const prevDate = new Date(firstDateObj.full);
            prevDate.setDate(prevDate.getDate() - 1);

            const newDate = getFormattedDate(prevDate);
            dates.unshift(newDate); 

            if (!itineraryData[newDate.full]) itineraryData[newDate.full] = [];
            
            selectedDate.value = newDate.full;
            setTimeout(() => {
                const container = document.querySelector('.overflow-x-auto');
                if(container) container.scrollLeft = 0;
            }, 100);
        };

        const deleteDate = (targetFull) => {
            if (dates.length <= 1) {
                alert("至少需要保留一天行程！");
                return;
            }
            if (!confirm(`確定要刪除 ${targetFull} 及其所有行程嗎？`)) return;

            const idx = dates.findIndex(d => d.full === targetFull);
            if (idx === -1) return;

            dates.splice(idx, 1);
            delete itineraryData[targetFull];

            const newIdx = Math.min(idx, dates.length - 1);
            selectedDate.value = dates[newIdx].full;
        };

        const defaultItinerary = {
            '2026-02-20': [
                { 
                    id: 1, 
                    name: '抵達關西機場', 
                    time: '10:40', 
                    category: '航班', 
                    flight: { from: 'KHH', to: 'KIX', dep: '06:55', arr: '10:40', no: 'IT284' },
                    transportMode: 'train', 
                    transportTime: '45分' 
                },
                { id: 2, name: 'Check-in (Eslead Hotel)', time: '13:00', category: '住宿', transportMode: 'walk', transportTime: '10分' },
                { id: 3, name: '新世界/通天閣', time: '14:00', category: '美食', transportMode: 'train', transportTime: '15分' },
                { id: 4, name: '心齋橋/難波 購物', time: '16:00', category: '購物', transportMode: 'walk', transportTime: '10分' },
                { id: 5, name: '燒肉力丸', time: '19:00', category: '美食', transportMode: 'walk', transportTime: '20分' },
                { id: 6, name: '阿倍野 HARUKAS 300', time: '20:30', category: '景點', note: '看夜景' }
            ],
            '2026-02-21': [
                { id: 1, name: '日本橋2號出口集合', time: '08:30', category: '其他', note: 'KKDay 一日團', transportMode: 'car', transportTime: '1小時' },
                { id: 2, name: '勝尾寺', time: '10:00', category: '景點', transportMode: 'car', transportTime: '50分' },
                { id: 3, name: '嵐山 (渡月橋/竹林)', time: '13:00', category: '景點', transportMode: 'car', transportTime: '40分' },
                { id: 4, name: '伏見稻荷大社', time: '15:30', category: '景點', transportMode: 'car', transportTime: '1小時' },
                { id: 5, name: '心齋橋覓食', time: '18:00', category: '美食' }
            ],
            '2026-02-22': [
                 { id: 1, name: '近鐵日本橋站集合', time: '08:00', category: '其他', note: 'KKDay 天橋立團', transportMode: 'car', transportTime: '2小時' },
                 { id: 2, name: '伊根灣遊船', time: '10:30', category: '景點', transportMode: 'car', transportTime: '30分' },
                 { id: 3, name: '天橋立 (傘松公園)', time: '13:00', category: '景點', transportMode: 'car', transportTime: '1小時' },
                 { id: 4, name: '美山茅屋之里', time: '15:30', category: '景點', transportMode: 'car', transportTime: '2小時' },
                 { id: 5, name: '蟹道樂東店/壽喜燒', time: '19:00', category: '美食', transportMode: 'walk', transportTime: '15分' },
                 { id: 6, name: '玉出超市 惠美須店', time: '21:00', category: '購物' }
            ],
            '2026-02-23': [
                { id: 1, name: '環球影城 USJ', time: '08:00', category: '景點', note: '整天! 記得買快速通關', transportMode: 'train', transportTime: '30分' }
            ],
            '2026-02-24': [
                { id: 1, name: 'Check-out', time: '08:00', category: '住宿', transportMode: 'train', transportTime: '50分' },
                { 
                    id: 2, 
                    name: '關西機場 (KIX)', 
                    time: '09:30', 
                    category: '航班', 
                    flight: { from: 'KIX', to: 'KHH', dep: '11:30', arr: '14:00', no: 'IT285', terminal: 'Terminal 1' }
                }
            ]
        };

        const itineraryData = reactive({ ...defaultItinerary });
        const shoppingList = reactive([]);
        const expenses = reactive([]);

        // --- Read and store logic ---
        const loadSavedData = () => {
            const savedItinerary = localStorage.getItem(STORAGE_KEYS.ITINERARY);
            if (savedItinerary) {
                try {
                    const parsed = JSON.parse(savedItinerary);
                    for (const key in itineraryData) delete itineraryData[key];
                    Object.assign(itineraryData, parsed);
                } catch(e) {}
            }
            const savedShopping = localStorage.getItem(STORAGE_KEYS.SHOPPING);
            if (savedShopping) {
                try {
                    const parsed = JSON.parse(savedShopping);
                    shoppingList.splice(0, shoppingList.length, ...parsed);
                } catch(e) {}
            }
            const savedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
            if (savedExpenses) {
                try {
                    const parsed = JSON.parse(savedExpenses);
                    expenses.splice(0, expenses.length, ...parsed);
                } catch(e) {}
            }
        };

        watch(itineraryData, (newVal) => localStorage.setItem(STORAGE_KEYS.ITINERARY, JSON.stringify(newVal)), { deep: true });
        watch(shoppingList, (newVal) => localStorage.setItem(STORAGE_KEYS.SHOPPING, JSON.stringify(newVal)), { deep: true });
        watch(expenses, (newVal) => localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(newVal)), { deep: true });

        onMounted(() => { loadSavedData(); getWeather(); getExchangeRate(); });

        const showModal = ref(false), isEditing = ref(false), form = reactive({ id: null, name: '', time: '', category: '景點', note: '', transportMode: 'walk' });
        
        const showShopModal = ref(false);
        const shopForm = reactive({ index: -1, name: '', image: null }); 

        const showExpenseModal = ref(false);
        const expenseForm = reactive({ id: null, date: '2026-02-20', name: '', amount: '', category: '飲食', payment: '現金', currency: 'JPY' });

        watch(() => expenseForm.currency, (newVal) => {
            if (newVal === 'TWD' && expenseForm.payment === '星展信用卡') {
                expenseForm.payment = '信用卡';
            }
        });

        const currentItinerary = computed(() => itineraryData[selectedDate.value] || []);
        
        const expensesStats = computed(() => {
            let totalJPY = 0;
            let totalTWD = 0;
            expenses.forEach(item => {
                const val = parseInt(item.amount || 0);
                if (item.currency === 'TWD') {
                    totalTWD += val;
                    totalJPY += (val / exchangeRate.value); 
                } else {
                    totalJPY += val;
                    totalTWD += (val * exchangeRate.value); 
                }
            });
            return { jpy: Math.round(totalJPY), twd: Math.round(totalTWD) };
        });

        const dbsStats = computed(() => {
            const dbsExpenses = expenses.filter(e => e.payment === '星展信用卡');
            const totalSpent = dbsExpenses.reduce((sum, item) => {
                let amountTWD = 0;
                if (item.currency === 'TWD') amountTWD = parseInt(item.amount || 0);
                else amountTWD = parseInt(item.amount || 0) * exchangeRate.value * 1.015;
                return sum + amountTWD;
            }, 0);
            const spentTWD = Math.round(totalSpent);
            const baseReward = Math.round(spentTWD * 0.01);
            const bonusCap = 600;
            const bonusRate = 0.04;
            const bonusLimitTWD = 15000;
            const bonusReward = Math.min(Math.round(spentTWD * bonusRate), bonusCap);
            const totalReward = baseReward + bonusReward;
            const percent = Math.min(Math.round((spentTWD / bonusLimitTWD) * 100), 100);
            return { spent: spentTWD, reward: totalReward, percent: percent };
        });

        const formatDate = (d) => d; 
        
        const getCategoryIcon = (c) => {
            const map = { '景點': 'fa-camera', '住宿': 'fa-bed', '美食': 'fa-utensils', '購物': 'fa-bag-shopping', '交通': 'fa-train', '其他': 'fa-star', '航班': 'fa-plane' };
            return `fa-solid ${map[c] || 'fa-circle'}`;
        };
        const getTransportIcon = (m) => {
            const map = { 'walk': 'fa-person-walking', 'car': 'fa-car', 'train': 'fa-train-subway' };
            return `fa-solid ${map[m] || 'fa-person-walking'}`;
        };
        
        const openMap = (k) => k && window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(k)}`, '_blank');
        
        const openAddModal = () => { isEditing.value = false; Object.assign(form, { id: Date.now(), name: '', time: '', category: '景點', note: '', transportMode: 'walk' }); showModal.value = true; };
        const editItem = (item) => { isEditing.value = true; Object.assign(form, item); showModal.value = true; };
        
        const saveItem = () => { 
            if (!itineraryData[selectedDate.value]) itineraryData[selectedDate.value] = [];
            const list = itineraryData[selectedDate.value];

            if (isEditing.value) { 
                const idx = list.findIndex(i => i.id === form.id); 
                if (idx !== -1) list[idx] = { ...form }; 
            } else { 
                list.push({ ...form }); 
            } 

            list.sort((a, b) => a.time.localeCompare(b.time));

            showModal.value = false; 
        };

        const deleteItem = () => { if(confirm('刪除？')) { const idx = itineraryData[selectedDate.value].findIndex(i => i.id === form.id); if (idx !== -1) itineraryData[selectedDate.value].splice(idx, 1); showModal.value = false; } };
        const closeModal = () => showModal.value = false;
        let dragStartIndex = null;
        const dragStart = (i) => dragStartIndex = i;
        const drop = (i) => { const list = itineraryData[selectedDate.value]; const item = list.splice(dragStartIndex, 1)[0]; list.splice(i, 0, item); dragStartIndex = null; };

        const openShopModal = (item = null, idx = -1) => { 
            shopForm.index = idx; 
            if (item) {
                shopForm.name = item.name;
                shopForm.image = item.image;
            } else {
                shopForm.name = '';
                shopForm.image = null;
            }
            showShopModal.value = true; 
        };

        const saveShopItem = () => { 
            if(shopForm.name) { 
                if (shopForm.index > -1) {
                    shoppingList[shopForm.index] = { name: shopForm.name, image: shopForm.image };
                } else {
                    shoppingList.push({ name: shopForm.name, image: shopForm.image }); 
                }
                showShopModal.value = false; 
            } 
        };

        const removeShoppingItem = (i) => { if(confirm('刪除？')) shoppingList.splice(i, 1); };

        const compressImage = (file, maxWidth = 400, quality = 0.7) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width, height = img.height;
                        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                        canvas.width = width; canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    };
                    img.onerror = (error) => reject(error);
                };
                reader.onerror = (error) => reject(error);
            });
        };
        const handleImageUpload = async (e) => { 
            const file = e.target.files[0]; 
            if(file) {
                try { shopForm.image = await compressImage(file); } 
                catch (error) { console.error("Img error"); }
            }
        };

        const openExpenseModal = (item = null) => { 
            if (item) Object.assign(expenseForm, item);
            else Object.assign(expenseForm, { id: null, date: '2026-02-20', name: '', amount: '', category: '飲食', payment: '現金', currency: 'JPY' });
            showExpenseModal.value = true; 
        };
        const saveExpense = () => { 
            if(expenseForm.amount) { 
                if (expenseForm.id) {
                    const idx = expenses.findIndex(e => e.id === expenseForm.id);
                    if (idx !== -1) expenses[idx] = { ...expenseForm };
                } else { expenses.unshift({ ...expenseForm, id: Date.now() }); }
                showExpenseModal.value = false; 
            } 
        };
        const deleteExpense = () => {
            if(confirm('確定要刪除此筆花費？')) {
                const idx = expenses.findIndex(e => e.id === expenseForm.id);
                if (idx !== -1) expenses.splice(idx, 1);
                showExpenseModal.value = false;
            }
        };

        const exportData = () => {
            const data = { itinerary: itineraryData, shopping: shoppingList, expenses: expenses };
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `大阪行程備份_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        const importData = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (confirm('匯入將會覆蓋目前手機上的所有資料，確定嗎？')) {
                        if (parsed.itinerary) { for (const key in itineraryData) delete itineraryData[key]; Object.assign(itineraryData, parsed.itinerary); }
                        if (parsed.shopping) { shoppingList.splice(0, shoppingList.length, ...parsed.shopping); }
                        if (parsed.expenses) { expenses.splice(0, expenses.length, ...parsed.expenses); }
                        alert('匯入成功！資料已同步。');
                    }
                } catch (err) { console.error(err); alert('檔案格式錯誤，無法匯入。'); }
            };
            reader.readAsText(file);
            event.target.value = '';
        };

        return { 
            currentTab, dates, selectedDate, formatDate, itineraryData, currentItinerary, 
            shoppingList, expenses, expensesStats, dbsStats,
            calcJpy, exchangeRate, weatherInfo, getCategoryIcon, getTransportIcon, openMap, 
            showModal, isEditing, form, openAddModal, editItem, saveItem, deleteItem, closeModal, dragStart, drop, 
            showShopModal, shopForm, openShopModal, handleImageUpload, saveShopItem, removeShoppingItem, 
            showExpenseModal, expenseForm, openExpenseModal, saveExpense, deleteExpense,
            exportData, importData,
            addNextDate, addPrevDate, deleteDate
        };
    }
}).mount('#app');