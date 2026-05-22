import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, ShoppingCart, Database, Sparkles, 
  Plus, X, Edit3, Trash2, Search, CheckCircle, AlertTriangle, ChevronRight, RefreshCw
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDoc 
} from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
const localFirebaseConfig = {
  apiKey: "AIzaSyAaHVrQTdjhag04ILWBFE8rcNrD_INZntE",
  authDomain: "student-council-voting-9f5fd.firebaseapp.com",
  projectId: "student-council-voting-9f5fd",
  storageBucket: "student-council-voting-9f5fd.firebasestorage.app",
  messagingSenderId: "812146981236",
  appId: "1:812146981236:web:f6148d957caa28d2d3d421",
  measurementId: "G-XNWR4ELZVZ"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : localFirebaseConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'kusina-keeper-v1';

// --- STYLES INJECTION ---
const injectStyles = () => {
  if (document.getElementById('kusina-styles-v7')) return;
  const style = document.createElement('style');
  style.id = 'kusina-styles-v7';
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
    
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #faf8f5;
      color: #3e3835;
      letter-spacing: -0.01em;
    }
    
    /* Custom Barcode Scanner Cover */
    #reader { 
      border: none !important; 
      border-radius: 20px; 
      overflow: hidden; 
      background: #181615; 
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    }
    #reader video { 
      object-fit: cover !important; 
      border-radius: 20px; 
    }
    #reader__dashboard_section_csr { display: none !important; }
    #reader__dashboard_section_swaplink { display: none !important; }
    #reader__status_span { color: #fff !important; font-size: 13px; }

    /* Recipe Popup Scroll Styling */
    .recipe-content {
      max-height: 55vh;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #c0ab99 #f7f3ee;
    }
  `;
  document.head.appendChild(style);

  // Load HTML5 QR Code library
  if (!document.getElementById('html5-qrcode-script')) {
    const qrScript = document.createElement('script');
    qrScript.id = 'html5-qrcode-script';
    qrScript.src = 'https://unpkg.com/html5-qrcode';
    document.head.appendChild(qrScript);
  }
};

// --- AUDIO BEEP ---
const playBeep = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {
    console.warn("Audio Context beep failed", e);
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [dictionary, setDictionary] = useState({});
  
  // UI States
  const [scannerMode, setScannerMode] = useState(null); // 'restock' | 'deplete' | null
  const [scanning, setScanning] = useState(false);
  
  // Navigation & Dropdown trigger state
  const [showNavActionDropdown, setShowNavActionDropdown] = useState(false);
  
  // Modals & Form Handlers
  const [itemForm, setItemForm] = useState(null);
  const [aiRecipe, setAiRecipe] = useState("");
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  
  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");
  const [toastMessage, setToastMessage] = useState("");
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);

  const dropdownRef = useRef(null);

  // Kitchen categories
  const categories = [
    'Produce',
    'Dairy',
    'Meat & Seafood',
    'Grains & Pasta',
    'Canned Goods',
    'Spices & Condiments',
    'Baking',
    'Snacks',
    'Beverages',
    'Others'
  ];

  // --- INITIALIZATION ---
  useEffect(() => {
    injectStyles();

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Authentication handshake error", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, setUser);

    // Close action dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNavActionDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // --- FIRESTORE REALTIME SYNC ---
  useEffect(() => {
    if (!user) return;

    const invRef = collection(db, 'artifacts', appId, 'users', user.uid, 'inventory');
    const dictRef = collection(db, 'artifacts', appId, 'users', user.uid, 'dictionary');

    const unsubInv = onSnapshot(query(invRef), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setInventory(items);
    }, (err) => console.error("Firestore Inventory error:", err));

    const unsubDict = onSnapshot(query(dictRef), (snap) => {
      const dict = {};
      snap.docs.forEach(d => { dict[d.id] = d.data(); });
      setDictionary(dict);
    }, (err) => console.error("Firestore Dictionary error:", err));

    return () => { unsubInv(); unsubDict(); };
  }, [user]);

  // --- QR/BARCODE SCANNING ---
  useEffect(() => {
    if (!scanning || !scannerMode || !window.Html5Qrcode) return;

    let html5QrCode;
    const startScanner = async () => {
      try {
        html5QrCode = new window.Html5Qrcode("reader");
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 160 } },
          (decodedText) => {
            handleScanSuccess(decodedText, html5QrCode);
          },
          () => { }
        );
      } catch (err) {
        console.error("Camera access failed", err);
        showToast("Unable to start scanner. Verify camera permissions.");
        setScanning(false);
      }
    };

    startScanner();

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
      }
    };
  }, [scanning, scannerMode]);

  const handleScanSuccess = async (barcode, scannerInstance) => {
    playBeep();
    
    if (scannerInstance && scannerInstance.isScanning) {
      await scannerInstance.stop();
      setScanning(false);
    }

    if (scannerMode === 'restock') {
      processRestock(barcode);
    } else if (scannerMode === 'deplete') {
      processDeplete(barcode);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // --- API / LOCAL DICTIONARY PRODUCT RESOLVER ---
  const lookupProduct = async (barcode) => {
    if (dictionary[barcode]) {
      return { barcode, ...dictionary[barcode] };
    }
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1) {
        const prod = data.product;
        
        // Auto-category mapping parsing from OFF tags
        let detectedCategory = 'Others';
        const rawTags = prod.categories_tags || [];
        const tagsJoined = rawTags.join(' ').toLowerCase();
        
        if (tagsJoined.includes('produce') || tagsJoined.includes('fruit') || tagsJoined.includes('vegetable')) {
          detectedCategory = 'Produce';
        } else if (tagsJoined.includes('dairy') || tagsJoined.includes('milk') || tagsJoined.includes('cheese')) {
          detectedCategory = 'Dairy';
        } else if (tagsJoined.includes('meat') || tagsJoined.includes('seafood') || tagsJoined.includes('fish') || tagsJoined.includes('chicken')) {
          detectedCategory = 'Meat & Seafood';
        } else if (tagsJoined.includes('grain') || tagsJoined.includes('pasta') || tagsJoined.includes('cereal') || tagsJoined.includes('rice') || tagsJoined.includes('bread')) {
          detectedCategory = 'Grains & Pasta';
        } else if (tagsJoined.includes('canned') || tagsJoined.includes('soup') || tagsJoined.includes('preserved')) {
          detectedCategory = 'Canned Goods';
        } else if (tagsJoined.includes('spice') || tagsJoined.includes('sauce') || tagsJoined.includes('condiment') || tagsJoined.includes('herb')) {
          detectedCategory = 'Spices & Condiments';
        } else if (tagsJoined.includes('bake') || tagsJoined.includes('flour') || tagsJoined.includes('sugar')) {
          detectedCategory = 'Baking';
        } else if (tagsJoined.includes('snack') || tagsJoined.includes('sweet') || tagsJoined.includes('cookie') || tagsJoined.includes('chip') || tagsJoined.includes('chocolate')) {
          detectedCategory = 'Snacks';
        } else if (tagsJoined.includes('beverage') || tagsJoined.includes('drink') || tagsJoined.includes('soda') || tagsJoined.includes('juice') || tagsJoined.includes('coffee') || tagsJoined.includes('tea')) {
          detectedCategory = 'Beverages';
        }

        return {
          barcode,
          name: prod.product_name || "",
          weight: prod.quantity || "",
          allergens: prod.allergens_from_ingredients ? prod.allergens_from_ingredients.replace(/en:/g, '') : "",
          nutriscore: prod.nutriscore_grade || "",
          category: detectedCategory
        };
      }
    } catch (err) {
      console.warn("Open Food Facts retrieval failed, fallback active.", err);
    }
    return { barcode, name: "", weight: "", allergens: "", nutriscore: "", category: "Others" };
  };

  const processRestock = async (barcode) => {
    const productInfo = await lookupProduct(barcode);
    
    setItemForm({
      ...productInfo,
      qty: 1,
      expirationDate: "",
      mode: 'restock',
      isNew: !productInfo.name
    });
  };

  const processDeplete = async (barcode) => {
    if (!user) return;
    
    const existingItems = inventory.filter(i => i.barcode === barcode && i.qty > 0);
    
    if (existingItems.length > 0) {
      const sorted = [...existingItems].sort((a, b) => {
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return new Date(a.expirationDate) - new Date(b.expirationDate);
      });
      const target = sorted[0];
      const newQty = Math.max(0, target.qty - 1);
      
      const itemRef = doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', target.id);
      await updateDoc(itemRef, { qty: newQty });
      showToast(`Reduced: ${target.name} (In stock: ${newQty})`);
    } else {
      showToast("This item is not present in your registered stock.");
    }
    
    setScanning(true);
  };

  // --- SAVE / REGISTER ITEM ---
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!user || !itemForm) return;

    if (itemForm.barcode) {
      const dictRef = doc(db, 'artifacts', appId, 'users', user.uid, 'dictionary', itemForm.barcode);
      await setDoc(dictRef, {
        name: itemForm.name,
        weight: itemForm.weight,
        allergens: itemForm.allergens || "",
        nutriscore: itemForm.nutriscore || "",
        category: itemForm.category
      }, { merge: true });
    }

    if (itemForm.id) {
      const itemRef = doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', itemForm.id);
      await updateDoc(itemRef, {
        name: itemForm.name,
        weight: itemForm.weight,
        category: itemForm.category,
        expirationDate: itemForm.expirationDate,
        qty: parseInt(itemForm.qty),
        allergens: itemForm.allergens || "",
        nutriscore: itemForm.nutriscore || ""
      });
      showToast("Information saved.");
    } else {
      const invRef = collection(db, 'artifacts', appId, 'users', user.uid, 'inventory');
      const newDocRef = doc(invRef);
      await setDoc(newDocRef, {
        barcode: itemForm.barcode || `MANUAL-${Date.now()}`,
        name: itemForm.name,
        weight: itemForm.weight,
        allergens: itemForm.allergens || "",
        nutriscore: itemForm.nutriscore || "",
        category: itemForm.category || 'Others',
        expirationDate: itemForm.expirationDate,
        qty: parseInt(itemForm.qty),
        dateAdded: new Date().toISOString()
      });
      showToast(`Registered ${itemForm.name}`);
    }

    const wasRestocking = itemForm.mode === 'restock';
    setItemForm(null);
    if (wasRestocking && scannerMode === 'restock') {
      setScanning(true);
    }
  };

  const adjustQty = async (item, delta) => {
    if (!user) return;
    const newQty = Math.max(0, item.qty + delta);
    const itemRef = doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', item.id);
    await updateDoc(itemRef, { qty: newQty });
  };

  const deleteItem = async (itemId) => {
    if (!user) return;
    const itemRef = doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', itemId);
    await deleteDoc(itemRef);
    showToast("Product deleted from register.");
  };

  // --- GEMINI AI RECIPE GENERATOR ---
  const generateRecipe = async () => {
    setLoadingRecipe(true);
    setAiRecipe("");
    setShowRecipeModal(true);
    
    const inStock = inventory.filter(i => i.qty > 0).map(i => `${i.name} (${i.weight || 'unit'})`).join(", ");
    const prompt = `Create an elegant, easy-to-follow recipe utilizing primarily these kitchen items: ${inStock || "none (recommend dynamic basics)"}. Aim for delicious, healthy food, with a bias towards modern Filipino home cooking if matching items. Cleanly break down into: Recipe Title, prep time, ingredients, and step-by-step directions. Output clearly without standard markdown bold symbols or asterisks.`;

    // The Canvas environment automatically provides the API key. Keep this empty.
    const apiKey = "AIzaSyAG8lCiJTrSIlQypT6jZ2NubcHFomPJ_38"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    
    // Exponential Backoff configuration
    const maxRetries = 5;
    const delays = [1000, 2000, 4000, 8000, 16000];
    let success = false;
    let text = "";

    for (let i = 0; i <= maxRetries; i++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();
        text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Chef's table is occupied. Try again soon.";
        success = true;
        break; // Success! Exit the retry loop
      } catch (err) {
        if (i < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delays[i]));
        }
      }
    }

    if (success) {
      text = text.replace(/\*\*/g, '')
                 .replace(/###/g, '')
                 .replace(/##/g, '');
      setAiRecipe(text);
    } else {
      setAiRecipe("Unable to reach Kusina AI. Please ensure you are connected to the internet and try again.");
    }
    
    setLoadingRecipe(false);
  };

  // --- UTILITY DATA ANALYSIS ---
  const getDaysUntilExpiry = (dateString) => {
    if (!dateString) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const expDate = new Date(dateString);
    const diffTime = expDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatCleanDate = (dateString) => {
    if (!dateString) return "";
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const renderExpiryDisplay = (dateString) => {
    if (!dateString) return null;
    const days = getDaysUntilExpiry(dateString);
    
    if (days < 0) return <span className="bg-[#dc2626] text-white font-bold text-[10px] tracking-[0.02em] border border-[#b91c1c] rounded px-2 py-1 align-middle inline-flex">Expired</span>;
    if (days === 0) return <span className="bg-[#dc2626] text-white font-bold text-[10px] tracking-[0.02em] border border-[#b91c1c] rounded px-2 py-1 align-middle inline-flex">Expires today</span>;
    if (days <= 14) return <span className="bg-[#dc2626] text-white font-bold text-[10px] tracking-[0.02em] border border-[#b91c1c] rounded px-2 py-1 align-middle inline-flex">Expires in {days}d</span>;
    
    return <span className="font-medium bg-white px-1.5 py-0.5 rounded border border-gray-200 uppercase inline-flex items-center" style={{ fontSize: '10px', color: '#53453f' }}>EXP: {formatCleanDate(dateString).toUpperCase()}</span>;
  };

  const getNutriScoreExplanation = (grade) => {
    if (!grade) return "";
    switch (grade.toLowerCase()) {
      case 'a': return "A - Excellent nutritional quality. Optimal balance of nutrients.";
      case 'b': return "B - Good nutritional quality. A healthy choice.";
      case 'c': return "C - Moderate nutritional quality. Consume in moderation.";
      case 'd': return "D - Poor nutritional quality. High in fats, sugar, or salt.";
      case 'e': return "E - Bad nutritional quality. Limit consumption.";
      default: return "Nutritional quality unknown.";
    }
  };

  const getNutriColor = (grade) => {
    const score = String(grade).toLowerCase();
    if (score === 'a') return '#038141';
    if (score === 'b') return '#85bb2f';
    if (score === 'c') return '#fec010';
    if (score === 'd') return '#ee811a';
    if (score === 'e') return '#e63e11';
    return '#8c8c8c';
  };

  const isValidNutriscore = (score) => {
    if (!score) return false;
    const clean = String(score).trim().toLowerCase();
    return clean !== "" && clean !== "unknown" && clean !== "n/a" && ["a", "b", "c", "d", "e"].includes(clean);
  };

  // Filtering Logic
  const inStockItems = inventory.filter(i => i.qty > 0);
  const outOfStockItems = inventory.filter(i => i.qty === 0);
  
  const filteredInStock = inStockItems.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategoryFilter === "All" || i.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const nearlyExpiredItems = inStockItems.filter(i => {
    const d = getDaysUntilExpiry(i.expirationDate);
    return d !== null && d <= 14;
  }).sort((a, b) => getDaysUntilExpiry(a.expirationDate) - getDaysUntilExpiry(b.expirationDate));

  return (
    <div className="min-h-screen flex flex-col pb-12 bg-[#faf8f5]">
      
      {/* HEADER SECTION WITH COMPACT EQUAL HEIGHT LOGO AND LOGOTYPE */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm px-4 py-3">
        <div className="container mx-auto max-w-5xl flex justify-between items-center h-[36px]">
          <div className="flex items-center cursor-pointer h-full" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="mr-2.5 flex items-center justify-center w-[35px] h-[35px] overflow-hidden rounded-md bg-[#f0f0f0]">
              <img src="https://i.ibb.co/rRzs3xkp/Kusina.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center">
              <h5 className="font-bold mb-0 text-[#3e3835] tracking-tight text-[20px] flex items-center">Kusina</h5>
            </div>
          </div>
          
          <div className="relative h-full" ref={dropdownRef}>
            <button 
              className="flex items-center justify-center rounded-full shadow-sm border-0 w-[32px] h-[32px] bg-[#879e7c] text-white hover:bg-[#768d6b] transition-colors"
              onClick={() => setShowNavActionDropdown(!showNavActionDropdown)}
            >
              <Plus size={15} />
            </button>
            
            {showNavActionDropdown && (
              <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-md border border-gray-200 p-2 z-30 w-[200px]">
                <div className="text-[9px] font-bold px-3 py-2 text-gray-500 uppercase">Quick Scan</div>
                <button 
                  className="flex items-center w-full p-2 rounded-lg text-sm text-[#3e3835] hover:bg-gray-100 transition-colors text-left"
                  onClick={() => { setShowNavActionDropdown(false); setScannerMode('restock'); setScanning(true); }}
                >
                  <PlusCircle size={15} className="text-green-600 mr-2" />
                  Scan & Restock
                </button>
                <button 
                  className="flex items-center w-full p-2 rounded-lg text-sm text-[#3e3835] hover:bg-gray-100 transition-colors text-left"
                  onClick={() => { setShowNavActionDropdown(false); setScannerMode('deplete'); setScanning(true); }}
                >
                  <ShoppingCart size={15} className="text-[#d9a029] mr-2" />
                  Scan & Deplete
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* COMPACT SCANNERS */}
      <div className="container mx-auto max-w-5xl mt-6 px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex items-stretch">
            <div 
              className="bg-[#f4f7f4] border border-[#e1eae1] rounded-[18px] p-4 w-full flex flex-col justify-center cursor-pointer transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(83,69,63,0.05)] sm:p-5"
              onClick={() => { setScannerMode('restock'); setScanning(true); }}
            >
              <div className="flex items-center">
                <div className="bg-white rounded-xl p-2 shadow-sm mr-3 flex items-center justify-center w-[50px] h-[50px] sm:w-[54px] sm:h-[54px] shrink-0">
                  <PlusCircle size={26} className="text-green-600" strokeWidth={1.5} />
                </div>
                <div>
                  <h6 className="text-green-600 uppercase font-bold mb-0 tracking-wider text-[10px]">Inbound</h6>
                  <h5 className="font-bold text-[#3e3835] mb-0 text-[15px]">Scan & Restock</h5>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-stretch">
            <div 
              className="bg-[#fff9eb] border border-[#f6ecce] rounded-[18px] p-4 w-full flex flex-col justify-center cursor-pointer transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(83,69,63,0.05)] sm:p-5"
              onClick={() => { setScannerMode('deplete'); setScanning(true); }}
            >
              <div className="flex items-center">
                <div className="bg-white rounded-xl p-2 shadow-sm mr-3 flex items-center justify-center w-[50px] h-[50px] sm:w-[54px] sm:h-[54px] shrink-0">
                  <ShoppingCart size={26} className="text-[#d9a029]" strokeWidth={1.5} />
                </div>
                <div>
                  <h6 className="text-[#c58a18] uppercase font-bold mb-0 tracking-wider text-[10px]">Outbound</h6>
                  <h5 className="font-bold text-[#3e3835] mb-0 text-[15px]">Scan & Deplete</h5>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BRIGHT MANUAL ADD BUTTON LOCATED DIRECTLY BELOW THE DUAL GRID */}
        <div 
          className="rounded-[18px] p-4 mb-4 text-center flex items-center justify-center cursor-pointer transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(83,69,63,0.05)] bg-[#e5efe2] border border-[#c8dcc3]"
          onClick={() => setItemForm({ barcode: "", name: "", weight: "", allergens: "", nutriscore: "", category: "Others", qty: 1, expirationDate: "", mode: 'manual' })}
        >
          <Database size={16} className="mr-2 text-green-700" />
          <span className="font-bold text-green-700 text-[13px]">Add Item Manually</span>
        </div>

        {/* AI MEAL PLANNER INTEGRATED STRIP */}
        <div className="bg-[#fcfbfa] border border-[#f1eeeb] rounded-[18px] p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(83,69,63,0.05)]">
          <div className="flex items-center">
            <div className="bg-[#fff9eb] border border-[#f6ecce] rounded-xl p-2 shadow-sm mr-3 flex items-center justify-center w-[42px] h-[42px]">
              <Sparkles size={20} className="text-[#d9a029]" />
            </div>
            <div>
              <h6 className="font-bold text-[#3e3835] mb-0 text-[14px]">What's Cooking? AI Assistant</h6>
              <p className="text-gray-500 mb-0 text-[11px]">Recommend healthy recipes strictly using your registered stock.</p>
            </div>
          </div>
          <button 
            className="bg-[#879e7c] hover:bg-[#768d6b] text-white rounded-xl px-4 py-2 font-semibold text-sm flex items-center justify-center transition-colors disabled:opacity-75"
            onClick={generateRecipe}
            disabled={loadingRecipe}
          >
            {loadingRecipe ? (
              <><RefreshCw size={13} className="mr-2 animate-spin" /> Suggesting...</>
            ) : (
              <><Sparkles size={13} className="mr-2" /> Plan Meal</>
            )}
          </button>
        </div>

        {/* SCANNING OVERLAY ELEMENT */}
        {scanning && (
          <div className="fixed inset-0 bg-black/75 z-50 flex flex-col justify-center items-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-[450px] shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h5 className="font-bold mb-0 text-[#3e3835] flex items-center text-[16px]">
                  <span className="relative flex h-3 w-3 mr-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  Scan Active ({scannerMode === 'restock' ? 'Restock' : 'Deplete'})
                </h5>
                <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full p-2 transition-colors" onClick={() => setScanning(false)}>
                  <X size={16} />
                </button>
              </div>
              <div id="reader" className="w-full mb-4"></div>
              <p className="text-gray-500 text-center text-[11px] mb-0">Focus barcode inside target box guidelines</p>
            </div>
          </div>
        )}

        {/* UNIFIED SINGLE-PAGE REGISTRY LOGS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* SPECIAL CLASSIFICATION SIDE PANELS */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            
            {/* 1. NEARLY EXPIRED SEGMENT */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <h6 className="font-bold text-[#3e3835] mb-4 flex items-center border-b border-gray-100 pb-3 text-[14px]">
                <AlertTriangle className="text-[#d9a029] mr-2" size={16} />
                Nearly Expired
                <span className="bg-gray-100 text-[#3e3835] ml-2 px-2 py-0.5 rounded-full text-[10px]">{nearlyExpiredItems.length}</span>
              </h6>
              {nearlyExpiredItems.length === 0 ? (
                <div className="text-center py-4 border border-dashed border-gray-200 rounded-xl">
                  <p className="text-gray-500 text-[11px] mb-0">No items expiring within 14 days.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {nearlyExpiredItems.map(item => {
                    return (
                      <div key={item.id} className="p-2 border border-gray-200 rounded-xl flex justify-between items-center bg-gray-50 text-[12px]">
                        <div className="truncate mr-2 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setSelectedProductDetails(item)}>
                          <div className="font-semibold text-[#3e3835] truncate">{item.name}</div>
                          <div className="text-gray-500 flex items-center gap-1.5 flex-wrap text-[10px]">
                            <span>{item.weight || 'No weight'}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex items-center">
                          {renderExpiryDisplay(item.expirationDate)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. OUT OF STOCK (GROCERY LIST) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <h6 className="font-bold text-[#3e3835] mb-4 flex items-center border-b border-gray-100 pb-3 text-[14px]">
                <ShoppingCart className="text-red-500 mr-2" size={16} />
                Out of Stock
                <span className="bg-gray-100 text-[#3e3835] ml-2 px-2 py-0.5 rounded-full text-[10px]">{outOfStockItems.length}</span>
              </h6>
              {outOfStockItems.length === 0 ? (
                <div className="text-center py-4 border border-dashed border-gray-200 rounded-xl">
                  <p className="text-gray-500 text-[11px] mb-0">Empty. All kitchen stock is registered.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {outOfStockItems.map(item => (
                    <div key={item.id} className="p-2 border border-gray-200 rounded-xl flex justify-between items-center text-[12px]">
                      <div className="truncate mr-2">
                        <div className="font-semibold text-[#3e3835] truncate">{item.name}</div>
                        <div className="text-gray-500 text-[10px]">{item.weight}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          className="px-2.5 py-1 border border-green-500 text-green-600 rounded-full hover:bg-green-50 transition-colors text-[10px]"
                          onClick={() => adjustQty(item, 1)}
                        >
                          + Restock
                        </button>
                        <button 
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-1.5 rounded-full transition-colors"
                          onClick={() => deleteItem(item.id)}
                        >
                          <Trash2 size={11} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* MAIN INVENTORY REGISTRY GRID */}
          <div className="lg:col-span-8">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <h5 className="font-bold mb-1 text-[#3e3835] tracking-tight text-[16px]">Storage Registry Logs</h5>
                  <p className="text-gray-500 text-[12px] mb-0">Manage items, allergens, and dietary ratings.</p>
                </div>
                
                {/* Search Bar + Dynamic Category Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-7 relative">
                    <Search size={14} className="absolute text-gray-400 left-3 top-2.5" />
                    <input 
                      type="text" 
                      className="w-full pl-9 pr-4 py-2 rounded-full bg-gray-100 border-0 text-[12px] text-[#3e3835] focus:outline-none focus:ring-2 focus:ring-[#879e7c]" 
                      placeholder="Search items..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-5 relative">
                    <select 
                      className="w-full px-4 py-2 rounded-full bg-gray-100 border-0 text-gray-500 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#879e7c] appearance-none"
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    >
                      <option value="All">All Categories</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <ChevronRight size={14} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none rotate-90" />
                  </div>
                </div>

                {/* VISUALLY APPEALING NUTRI-SCORE LEGEND */}
                <div className="bg-gray-50 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 border border-gray-200">
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="text-gray-500 font-semibold mr-1">Nutri-Score:</span>
                    <span className="w-[14px] h-[14px] rounded-full inline-flex items-center justify-center text-white font-bold font-mono text-[8px] leading-none shrink-0" style={{ backgroundColor: '#038141' }}>A</span>
                    <span className="w-[14px] h-[14px] rounded-full inline-flex items-center justify-center text-white font-bold font-mono text-[8px] leading-none shrink-0" style={{ backgroundColor: '#85bb2f' }}>B</span>
                    <span className="w-[14px] h-[14px] rounded-full inline-flex items-center justify-center text-white font-bold font-mono text-[8px] leading-none shrink-0" style={{ backgroundColor: '#fec010' }}>C</span>
                    <span className="w-[14px] h-[14px] rounded-full inline-flex items-center justify-center text-white font-bold font-mono text-[8px] leading-none shrink-0" style={{ backgroundColor: '#ee811a' }}>D</span>
                    <span className="w-[14px] h-[14px] rounded-full inline-flex items-center justify-center text-white font-bold font-mono text-[8px] leading-none shrink-0" style={{ backgroundColor: '#e63e11' }}>E</span>
                  </div>
                </div>
              </div>

              {/* Categorized Stock Output */}
              {categories.map(cat => {
                const catItems = filteredInStock.filter(i => i.category === cat);
                if (catItems.length === 0) return null;
                
                return (
                  <div key={cat} className="mb-6">
                    <div className="flex items-center mb-3 pb-2 border-b border-gray-100">
                      <span className="text-gray-500 uppercase font-bold tracking-wider text-[10px]">{cat}</span>
                      <span className="bg-gray-100 text-[#3e3835] ml-2 px-2 py-0.5 rounded-full text-[9px]">{catItems.length}</span>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {catItems.map(item => {
                        const hasScore = isValidNutriscore(item.nutriscore);
                        
                        return (
                          <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 flex justify-between items-center">
                            <div className="truncate mr-3 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setSelectedProductDetails(item)}>
                              <div className="font-semibold text-[#3e3835] mb-1 truncate flex items-center flex-wrap gap-2 text-[13px]">
                                <span>{item.name}</span>
                                {/* Perfect Circle Nutri-Score Color Tag - Excludes empty/unknown scores */}
                                {hasScore && (
                                  <span 
                                    className="w-[14px] h-[14px] rounded-full inline-flex items-center justify-center text-white font-bold font-mono text-[8px] leading-none shrink-0 align-middle" 
                                    style={{ backgroundColor: getNutriColor(item.nutriscore) }}
                                    title={`Nutri-Score ${item.nutriscore.toUpperCase()}`}
                                  >
                                    {item.nutriscore.toUpperCase()}
                                  </span>
                                )}
                              </div>
                              
                              {/* Meta Indicators - Spread and Uncrowded */}
                              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px]">
                                <span className="bg-white text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 uppercase">{item.weight || 'WEIGHT UNSPECIFIED'}</span>
                                {renderExpiryDisplay(item.expirationDate)}
                                {item.allergens && (
                                  <span className="bg-orange-500/10 border border-orange-500 text-orange-700 font-bold px-1.5 py-[1px] rounded inline-flex items-center text-[10px]">
                                    Allergens: {item.allergens}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Actions & Adjusters */}
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center border border-gray-200 bg-white rounded-full px-1">
                                <button className="px-1.5 py-0.5 text-gray-500 hover:text-gray-700 text-[12px] font-medium transition-colors" onClick={() => adjustQty(item, -1)}>-</button>
                                <span className="font-bold px-2 text-[11px] min-w-[20px] text-center">{item.qty}</span>
                                <button className="px-1.5 py-0.5 text-gray-500 hover:text-gray-700 text-[12px] font-medium transition-colors" onClick={() => adjustQty(item, 1)}>+</button>
                              </div>
                              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full w-[28px] h-[28px] inline-flex items-center justify-center transition-colors" onClick={() => setItemForm({ ...item, mode: 'edit' })} title="Edit item">
                                <Edit3 size={11} />
                              </button>
                              <button className="bg-gray-100 hover:bg-red-100 text-red-500 rounded-full w-[28px] h-[28px] inline-flex items-center justify-center transition-colors" onClick={() => deleteItem(item.id)} title="Delete item">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredInStock.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-sm">No registered storage entries found.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* POPUP TOAST NOTIFICATIONS */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 z-50 pointer-events-none">
          <div className="bg-gray-800 text-white px-5 py-3 rounded-full shadow-lg flex items-center text-[12px] font-medium">
            <CheckCircle size={14} className="mr-2 text-green-400 shrink-0" /> {toastMessage}
          </div>
        </div>
      )}

      {/* CLEAN AI RECIPE POPUP */}
      {showRecipeModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px]">
            <div className="p-4 sm:p-5 border-b border-gray-200 flex justify-between items-center">
              <h5 className="font-bold mb-0 text-[#3e3835] flex items-center text-[16px]">
                <Sparkles size={16} className="text-[#d9a029] mr-2" />
                Suggested Recipe
              </h5>
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full p-2 transition-colors" onClick={() => { setShowRecipeModal(false); setAiRecipe(""); }}>
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 sm:p-5">
              {loadingRecipe ? (
                <div className="text-center py-10">
                  <RefreshCw size={28} className="animate-spin text-green-600 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">AI Chef is drafting personalized kitchen suggestions...</p>
                </div>
              ) : (
                <>
                  <div className="recipe-content text-[#3e3835] mb-5">
                    {aiRecipe.split('\n').map((para, i) => {
                      if (!para.trim()) return null;
                      if (para.toLowerCase().includes('ingredients') || para.toLowerCase().includes('directions') || para.toLowerCase().includes('steps') || para.toLowerCase().includes('instructions') || para.toLowerCase().includes('recipe')) {
                        return <h6 key={i} className="font-bold mt-4 mb-2 text-green-700 uppercase tracking-wide text-[13px]">{para}</h6>;
                      }
                      if (para.trim().startsWith('-') || para.trim().startsWith('•') || para.trim().startsWith('*')) {
                        return <li key={i} className="mb-1.5 ml-4 text-sm list-disc">{para.replace(/^[-•*]\s*/, '')}</li>;
                      }
                      return <p key={i} className="mb-2 text-sm leading-relaxed">{para}</p>;
                    })}
                  </div>
                  <button className="bg-[#53453f] hover:bg-[#443731] text-white w-full py-3 font-semibold rounded-xl text-sm transition-colors" onClick={() => { setShowRecipeModal(false); setAiRecipe(""); }}>
                    Looks Tasty, Thanks!
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REGISTRATION FORM */}
      {itemForm && (
        <div className="fixed inset-0 bg-black/75 z-[60] flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[440px] max-h-[90vh] overflow-y-auto">
            <div className="px-4 sm:px-5 py-3 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h5 className="font-bold mb-0 text-[#3e3835] text-[15px]">
                {itemForm.isNew ? 'New Product Discovered' : itemForm.mode === 'edit' ? 'Modify Item' : 'Restock Item'}
              </h5>
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full p-2 transition-colors" onClick={() => {
                const wasRestocking = itemForm.mode === 'restock';
                setItemForm(null);
                if (wasRestocking && scannerMode === 'restock') setScanning(true);
              }}>
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSaveItem} className="px-4 sm:px-5 pt-3 pb-5">
              {itemForm.isNew && (
                <div className="bg-yellow-50 text-yellow-800 border border-yellow-200 p-3 rounded-xl mb-4 text-[11px] flex items-center">
                  <AlertTriangle className="mr-2.5 text-yellow-500 shrink-0" size={16} />
                  Product not found in registry database. Please fill in details manually to register this item.
                </div>
              )}

              {itemForm.barcode && (
                <div className="mb-3">
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Barcode ID</label>
                  <input type="text" className="w-full bg-gray-100 border border-transparent rounded-lg px-3 py-2 text-[12px] text-gray-600 focus:outline-none" value={itemForm.barcode} readOnly />
                </div>
              )}
              
              <div className="mb-3">
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Product Name</label>
                <input 
                  type="text" 
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#879e7c] focus:border-transparent" 
                  value={itemForm.name} 
                  onChange={(e) => setItemForm({...itemForm, name: e.target.value})} 
                  required 
                  placeholder="e.g., Soy Sauce"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Quantity</label>
                  <input 
                    type="number" 
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#879e7c] focus:border-transparent" 
                    value={itemForm.qty} 
                    onChange={(e) => setItemForm({...itemForm, qty: e.target.value})} 
                    required 
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Weight / Size</label>
                  <input 
                    type="text" 
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#879e7c] focus:border-transparent" 
                    value={itemForm.weight} 
                    onChange={(e) => setItemForm({...itemForm, weight: e.target.value})} 
                    placeholder="e.g., 500ml"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Expiration Date</label>
                  <input 
                    type="date" 
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#879e7c] focus:border-transparent" 
                    value={itemForm.expirationDate || ''} 
                    onChange={(e) => setItemForm({...itemForm, expirationDate: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Category</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#879e7c] focus:border-transparent appearance-none" 
                      value={itemForm.category} 
                      onChange={(e) => setItemForm({...itemForm, category: e.target.value})}
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <ChevronRight size={14} className="absolute right-3 top-[10px] text-gray-400 pointer-events-none rotate-90" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3 mb-5">
                <div className="col-span-8">
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Allergy Warnings</label>
                  <input 
                    type="text" 
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#879e7c] focus:border-transparent" 
                    value={itemForm.allergens} 
                    onChange={(e) => setItemForm({...itemForm, allergens: e.target.value})} 
                    placeholder="e.g., Soy, Peanuts"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Nutri-Score</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#879e7c] focus:border-transparent appearance-none" 
                      value={itemForm.nutriscore || ""} 
                      onChange={(e) => setItemForm({...itemForm, nutriscore: e.target.value})}
                    >
                      <option value="">N/A</option>
                      <option value="a">A</option>
                      <option value="b">B</option>
                      <option value="c">C</option>
                      <option value="d">D</option>
                      <option value="e">E</option>
                    </select>
                    <ChevronRight size={14} className="absolute right-3 top-[10px] text-gray-400 pointer-events-none rotate-90" />
                  </div>
                </div>
              </div>

              {/* REGISTER BUTTON */}
              <button 
                type="submit" 
                className="bg-[#879e7c] hover:bg-[#768d6b] text-white w-full py-3 font-semibold rounded-xl text-[13px] transition-colors shadow-sm" 
              >
                REGISTER
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DETAILED PRODUCT PROFILE MODAL */}
      {selectedProductDetails && (
        <div className="fixed inset-0 bg-black/75 z-[70] flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px]">
            <div className="p-4 sm:p-5 border-b border-gray-200 flex justify-between items-center">
              <h5 className="font-bold mb-0 text-[#3e3835] text-[15px]">Product Profile</h5>
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full p-2 transition-colors" onClick={() => setSelectedProductDetails(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="p-4 sm:p-5">
              <h4 className="font-bold text-[#3e3835] mb-1.5">{selectedProductDetails.name}</h4>
              <p className="text-gray-500 text-sm mb-5">{selectedProductDetails.category} • {selectedProductDetails.weight || 'No weight listed'}</p>
              
              <div className="flex flex-col gap-4">
                {/* Expiration Section */}
                <div>
                  <div className="uppercase text-gray-500 font-bold mb-2 text-[10px] tracking-wider">Expiration Status</div>
                  {selectedProductDetails.expirationDate ? (
                    <div className="flex items-center gap-2">
                      {renderExpiryDisplay(selectedProductDetails.expirationDate)}
                    </div>
                  ) : <span className="text-gray-500 text-sm">Not specified</span>}
                </div>

                {/* Allergens Section */}
                {selectedProductDetails.allergens && (
                  <div>
                    <div className="uppercase text-gray-500 font-bold mb-2 text-[10px] tracking-wider">Allergen Warnings</div>
                    <span className="bg-orange-500/10 border border-orange-500 text-orange-700 font-bold px-2 py-1 rounded inline-flex items-center text-[11px]">
                      {selectedProductDetails.allergens}
                    </span>
                  </div>
                )}

                {/* Nutri-Score Explanation Section */}
                {isValidNutriscore(selectedProductDetails.nutriscore) && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2">
                    <div className="uppercase text-gray-500 font-bold mb-3 text-[10px] tracking-wider">Dietary Rating</div>
                    <div className="flex items-start gap-3">
                      <span 
                        className="rounded-full shadow-sm mt-0.5 inline-flex items-center justify-center text-white font-bold font-mono shrink-0 w-[32px] h-[32px] text-[18px]" 
                        style={{ backgroundColor: getNutriColor(selectedProductDetails.nutriscore) }}
                      >
                        {selectedProductDetails.nutriscore.toUpperCase()}
                      </span>
                      <div className="text-[#3e3835] leading-snug pt-1 text-[13px]">
                        {getNutriScoreExplanation(selectedProductDetails.nutriscore)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
