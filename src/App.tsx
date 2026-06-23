/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, Award, Clock, Download, Upload, Bell, Sliders, 
  Users, Settings as SettingsIcon, LifeBuoy, ShieldAlert, Shield, LogOut,
  Menu, X, Sparkles, MessageSquare, Send, Check, AlertTriangle, ChevronDown,
  Eye, EyeOff, Smartphone, Lock, Globe, Loader, Sun, Moon, Volume2, VolumeX,
  Zap, Cpu, ShieldCheck, Star, ArrowRight, LineChart
} from 'lucide-react';
import { api, setToken, getToken, clearToken } from './lib/api.js';
import { Profile, Plan, Transaction, Announcement, CoingeckoPrice } from './types.js';
import { translations, LanguageCode, LANGUAGES } from './locales.ts';
import { motion, AnimatePresence } from 'motion/react';

// Core layout/page views imports
import Navbar from './components/Navbar.tsx';
import Footer from './components/Footer.tsx';
import Plans from './components/Plans.tsx';
import Overview from './components/Overview.tsx';
import Transactions from './components/Transactions.tsx';
import DepositModal from './components/DepositModal.tsx';
import Withdraw from './components/Withdraw.tsx';
import Notifications from './components/Notifications.tsx';
import ActivityLogs from './components/ActivityLogs.tsx';
import Referrals from './components/Referrals.tsx';
import Settings from './components/Settings.tsx';
import Support from './components/Support.tsx';
import AdminPanel from './components/AdminPanel.tsx';

// @ts-ignore
import chatPopSound from './assets/chat-pop.wav';

interface RouteState {
  currentPage: string;
  dashboardTab: string;
  isDepositModalOpen?: boolean;
}

const decodePath = (path: string, loggedIn: boolean): RouteState => {
  const cleanPath = path.toLowerCase().replace(/\/$/, '') || '/';
  
  // Public/Landing paths
  if (cleanPath === '/' || cleanPath === '/home') {
    return { currentPage: 'home', dashboardTab: 'overview' };
  }
  if (cleanPath === '/login') {
    return { currentPage: 'login', dashboardTab: 'overview' };
  }
  if (cleanPath === '/register') {
    return { currentPage: 'register', dashboardTab: 'overview' };
  }
  if (cleanPath === '/reset-password' || cleanPath === '/forgot-password') {
    return { currentPage: 'reset-password', dashboardTab: 'overview' };
  }

  // Dashboard/Protected paths
  if (cleanPath === '/dashboard') {
    return { currentPage: loggedIn ? 'dashboard' : 'login', dashboardTab: 'overview' };
  }
  if (cleanPath === '/admin') {
    return { currentPage: loggedIn ? 'dashboard' : 'login', dashboardTab: 'admin' };
  }
  if (cleanPath === '/contracts' || cleanPath === '/plans') {
    return { currentPage: loggedIn ? 'dashboard' : 'login', dashboardTab: 'plans' };
  }
  if (cleanPath === '/deposits' || cleanPath === '/deposit') {
    return { currentPage: loggedIn ? 'dashboard' : 'login', dashboardTab: 'transactions', isDepositModalOpen: true };
  }
  if (cleanPath === '/transactions') {
    return { currentPage: loggedIn ? 'dashboard' : 'login', dashboardTab: 'transactions' };
  }
  if (cleanPath === '/withdraw' || cleanPath === '/withdrawal') {
    return { currentPage: loggedIn ? 'dashboard' : 'login', dashboardTab: 'withdraw' };
  }
  if (cleanPath === '/notifications') {
    return { currentPage: loggedIn ? 'dashboard' : 'login', dashboardTab: 'notifications' };
  }
  if (cleanPath === '/activity-logs') {
    return { currentPage: loggedIn ? 'dashboard' : 'login', dashboardTab: 'activity-logs' };
  }
  if (cleanPath === '/referrals' || cleanPath === '/referral') {
    return { currentPage: loggedIn ? 'dashboard' : 'login', dashboardTab: 'referrals' };
  }
  if (cleanPath === '/settings') {
    return { currentPage: loggedIn ? 'dashboard' : 'login', dashboardTab: 'settings' };
  }
  if (cleanPath === '/support') {
    return { currentPage: loggedIn ? 'dashboard' : 'login', dashboardTab: 'support' };
  }

  // Fallback for anything else
  return { currentPage: 'home', dashboardTab: 'overview' };
};

const encodeState = (currentPage: string, dashboardTab: string, isDepositModalOpen: boolean): string => {
  if (currentPage === 'home') return '/';
  if (currentPage === 'login') return '/login';
  if (currentPage === 'register') return '/register';
  if (currentPage === 'reset-password') return '/reset-password';
  
  if (currentPage === 'dashboard') {
    if (isDepositModalOpen) return '/deposits';
    if (dashboardTab === 'overview') return '/dashboard';
    if (dashboardTab === 'admin') return '/admin';
    if (dashboardTab === 'plans') return '/contracts';
    if (dashboardTab === 'transactions') return '/transactions';
    if (dashboardTab === 'withdraw') return '/withdraw';
    if (dashboardTab === 'notifications') return '/notifications';
    if (dashboardTab === 'activity-logs') return '/activity-logs';
    if (dashboardTab === 'referrals') return '/referrals';
    if (dashboardTab === 'settings') return '/settings';
    if (dashboardTab === 'support') return '/support';
    return `/dashboard`;
  }
  return '/';
};

export default function App() {
  // Navigation & session state
  const [currentPage, setCurrentPage] = useState<string>(() => {
    const path = window.location.pathname;
    const cleanPath = path.toLowerCase().replace(/\/$/, '') || '/';
    if (cleanPath === '/' || cleanPath === '/home') return 'home';
    if (cleanPath === '/login') return 'login';
    if (cleanPath === '/register') return 'register';
    if (cleanPath === '/reset-password' || cleanPath === '/forgot-password') return 'reset-password';
    return 'dashboard';
  }); // 'home' | 'login' | 'register' | 'reset-password' | 'dashboard'

  const [dashboardTab, setDashboardTab] = useState<string>(() => {
    const path = window.location.pathname;
    const cleanPath = path.toLowerCase().replace(/\/$/, '') || '/';
    if (cleanPath === '/admin') return 'admin';
    if (cleanPath === '/contracts' || cleanPath === '/plans') return 'plans';
    if (cleanPath === '/deposits' || cleanPath === '/deposit') return 'transactions';
    if (cleanPath === '/transactions') return 'transactions';
    if (cleanPath === '/withdraw' || cleanPath === '/withdrawal') return 'withdraw';
    if (cleanPath === '/notifications') return 'notifications';
    if (cleanPath === '/activity-logs') return 'activity-logs';
    if (cleanPath === '/referrals' || cleanPath === '/referral') return 'referrals';
    if (cleanPath === '/settings') return 'settings';
    if (cleanPath === '/support') return 'support';
    return 'overview';
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);

  // Common system resources
  const [plans, setPlans] = useState<Plan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [btcPrice, setBtcPrice] = useState<CoingeckoPrice>({ btc_usd: 68420.0, change_24h: 1.84 });

  // Localization states
  const [currentLang, setCurrentLang] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('cryptobtc_miner_lang');
    if (saved && ['en', 'fr', 'ar', 'es', 'pt', 'zh', 'hi', 'ru', 'sw'].includes(saved)) {
      return saved as LanguageCode;
    }
    return 'en';
  });

  useEffect(() => {
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  }, [currentLang]);

  const t = translations[currentLang] || translations['en'];

  // 2FA Security popup banner alert state
  const [dismissed2FaAlert, setDismissed2FaAlert] = useState<boolean>(() => {
    return localStorage.getItem('cryptobtc_miner_2fa_alert_dismissed') === 'true' ||
           sessionStorage.getItem('cryptobtc_miner_2fa_alert_dismissed_session') === 'true';
  });

  // Custom layout states
  const [isSignupDetailsLoading, setIsSignupDetailsLoading] = useState(false);
  const [isSignupOtpLoading, setIsSignupOtpLoading] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [is2faLoading, setIs2faLoading] = useState(false);
  const [isResetRequestLoading, setIsResetRequestLoading] = useState(false);
  const [isResetVerifyLoading, setIsResetVerifyLoading] = useState(false);

  const [signupStep, setSignupStep] = useState<'details' | 'otp'>('details');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupReferral, setSignupReferral] = useState('');
  const [signupCodeInput, setSignupCodeInput] = useState('');
  const [developerOtpDisplay, setDeveloperOtpDisplay] = useState('');

  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCodeInput, setResetCodeInput] = useState('');
  const [forgotDeveloperOtp, setForgotDeveloperOtp] = useState('');

  // Resend OTP countdown states
  const [signupResendTimer, setSignupResendTimer] = useState(0);
  const [resetResendTimer, setResetResendTimer] = useState(0);

  // 2FA login gates
  const [loginNeeds2fa, setLoginNeeds2fa] = useState<boolean>(false);
  const [login2faEmail, setLogin2faEmail] = useState<string>('');
  const [login2faPassword, setLogin2faPassword] = useState<string>('');
  const [login2faCode, setLogin2faCode] = useState<string>('');

  // Password Visibility controllers
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState<boolean>(false);

  // Initial settings segment
  const [initialSettingsSegment, setInitialSettingsSegment] = useState<'profile' | 'security' | 'privacy' | 'notifications'>('profile');

  // Live landing page real-time counter
  const [liveBtcMined, setLiveBtcMined] = useState<number>(2430.45781290);
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveBtcMined(prev => prev + 0.00000004 + Math.random() * 0.00000003);
    }, 1300);
    return () => clearInterval(interval);
  }, []);

  // UI state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(() => {
    const path = window.location.pathname;
    const cleanPath = path.toLowerCase().replace(/\/$/, '') || '/';
    return cleanPath === '/deposits' || cleanPath === '/deposit';
  });
  const [selectedPlanForDeposit, setSelectedPlanForDeposit] = useState<Plan | null>(null);
  const [alertText, setAlertText] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Floating live chatbot toggles (Tidio)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('cryptobtc_miner_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('cryptobtc_miner_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const [chatOpen, setChatOpen] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem('cryptobtc_miner_sound_muted');
    return saved === 'true';
  });

  const synthesizePopSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        console.warn('Web Audio API is not supported in this browser.');
        return;
      }
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      // High quality, warm bubble pop sweep
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.12);
      
      // Enveloped sound
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (err) {
      console.warn('Synthesis play attempt failed:', err);
    }
  };

  const playChatPopSound = () => {
    if (isSoundMuted) return;
    try {
      const audio = new Audio(chatPopSound);
      audio.volume = 0.55;
      audio.play().catch(ev => {
        console.log('Audio file play blocked or deferred, activating real-time synthetic pop:', ev);
        synthesizePopSound();
      });
    } catch (e) {
      console.warn('Audio play failed, activating real-time synthetic pop:', e);
      synthesizePopSound();
    }
  };
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string; time: string }>>([
    { sender: 'bot', text: 'Hello! Welcome to CryptoBTC Miner instant helper. How can I assist you with your node configuration or deposit today?', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat window when new message arrives or bot starts typing
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatTyping, chatOpen]);

  // Landing page FAQ dropdown state
  const [landingFaqIndex, setLandingFaqIndex] = useState<number | null>(null);

  // Sync page & tab states with localStorage and browser path
  useEffect(() => {
    const newPath = encodeState(currentPage, dashboardTab, isDepositModalOpen);
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
    localStorage.setItem('cryptobtc_miner_current_page', currentPage);
  }, [currentPage]);

  useEffect(() => {
    const newPath = encodeState(currentPage, dashboardTab, isDepositModalOpen);
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
    localStorage.setItem('cryptobtc_miner_dashboard_tab', dashboardTab);
  }, [dashboardTab]);

  useEffect(() => {
    const newPath = encodeState(currentPage, dashboardTab, isDepositModalOpen);
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  }, [isDepositModalOpen]);

  // Listen for browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const decoded = decodePath(window.location.pathname, isLoggedIn);
      setCurrentPage(decoded.currentPage);
      setDashboardTab(decoded.dashboardTab);
      if (decoded.isDepositModalOpen !== undefined) {
        setIsDepositModalOpen(decoded.isDepositModalOpen);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLoggedIn]);

  // --- FLASH TOAST MESSENGER ---
  const triggerToast = (msg: string, type: 'success' | 'error') => {
    setAlertText({ msg, type });
    setTimeout(() => {
      setAlertText(null);
    }, 4500);
  };

  // --- TIMER EFFECTS ---
  useEffect(() => {
    if (signupResendTimer > 0) {
      const timer = setTimeout(() => setSignupResendTimer(signupResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [signupResendTimer]);

  useEffect(() => {
    if (resetResendTimer > 0) {
      const timer = setTimeout(() => setResetResendTimer(resetResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resetResendTimer]);

  const handleResendSignupOtp = async () => {
    if (signupResendTimer > 0) return;
    try {
      await api.sendSignupOtp({ 
        name: signupName, 
        email: signupEmail, 
        password: signupPassword, 
        referralCode: signupReferral 
      });
      setSignupResendTimer(30);
      triggerToast('A new 6-digit registration verification code has been dispatched!', 'success');
    } catch (err: any) {
      triggerToast(err.message || 'Error occurred resending OTP code.', 'error');
    }
  };

  const handleResendResetOtp = async () => {
    if (resetResendTimer > 0) return;
    try {
      await api.forgotPassword(resetEmail);
      setResetResendTimer(300);
      triggerToast('A new password recovery OTP verification code has been dispatched!', 'success');
    } catch (err: any) {
      triggerToast(err.message || 'Error occurred resending OTP code.', 'error');
    }
  };

  // --- LOADING ALL ESSENTIAL APP RESOURCES ---
  useEffect(() => {
    // 1. Fetch initial plans catalog & prices right on mount
    loadPlans();
    
    // 2. Poll CoinGecko price proxy every 30s
    loadBtcPrice();
    const btcInterval = setInterval(loadBtcPrice, 30050);

    // 3. Track existing user session
    const checkSession = async () => {
      const savedToken = getToken();
      if (savedToken) {
        try {
          const profileRes = await api.getProfile();
          setUserProfile(profileRes);
          setIsLoggedIn(true);

          if (profileRes.detected_language && ['en', 'fr', 'ar', 'es', 'pt', 'zh', 'hi', 'ru', 'sw'].includes(profileRes.detected_language)) {
            setCurrentLang(profileRes.detected_language as LanguageCode);
            localStorage.setItem('cryptobtc_miner_lang', profileRes.detected_language);
          }
          
          // Respect URL path if we are logged in, otherwise route correctly
          const urlPath = window.location.pathname;
          const cleanPath = urlPath.toLowerCase().replace(/\/$/, '') || '/';
          if (cleanPath === '/' || cleanPath === '/home' || cleanPath === '/login' || cleanPath === '/register') {
            setCurrentPage('dashboard');
            if (profileRes.is_admin) {
              setDashboardTab('admin');
            } else {
              setDashboardTab('overview');
            }
          } else {
            const decoded = decodePath(urlPath, true);
            setCurrentPage(decoded.currentPage);
            if (profileRes.is_admin && decoded.dashboardTab === 'overview') {
              setDashboardTab('admin');
            } else {
              setDashboardTab(decoded.dashboardTab);
            }
            if (decoded.isDepositModalOpen !== undefined) {
              setIsDepositModalOpen(decoded.isDepositModalOpen);
            }
          }
          
          loadDashboardAssets();
        } catch (e) {
          clearToken();
          setIsLoggedIn(false);
          setUserProfile(null);
          setCurrentPage('home');
        }
      } else {
        // Visitor auto language geocode detection using free ipapi.co or fallback ip-api.com
        const savedLang = localStorage.getItem('cryptobtc_miner_lang');
        if (!savedLang) {
          try {
            const ipRes = await fetch('https://ipapi.co/json/').catch(() => null);
            if (ipRes && ipRes.ok) {
              const ipData = await ipRes.json();
              if (ipData && ipData.country_code) {
                const countryCode = ipData.country_code.toUpperCase();
                const langMapping: Record<string, LanguageCode> = {
                  'SA': 'ar', 'AE': 'ar', 'QA': 'ar', 'EG': 'ar', 'DZ': 'ar', 'JO': 'ar', 'LB': 'ar', 'OM': 'ar', 'YE': 'ar', 'IQ': 'ar', 'KW': 'ar', 'BH': 'ar',
                  'FR': 'fr', 'CA': 'fr', 'CD': 'fr', 'CG': 'fr', 'CI': 'fr', 'SN': 'fr', 'NE': 'fr', 'ML': 'fr',
                  'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'CL': 'es', 'PE': 'es', 'VE': 'es',
                  'PT': 'pt', 'BR': 'pt', 'AO': 'pt', 'MZ': 'pt',
                  'CN': 'zh',
                  'IN': 'hi',
                  'RU': 'ru',
                  'NG': 'en',
                  'KE': 'sw', 'TZ': 'sw', 'UG': 'sw'
                };
                const detectedL = langMapping[countryCode] || 'en';
                setCurrentLang(detectedL);
                localStorage.setItem('cryptobtc_miner_lang', detectedL);
              }
            } else {
              const ipRes2 = await fetch('http://ip-api.com/json').catch(() => null);
              if (ipRes2 && ipRes2.ok) {
                const ipData2 = await ipRes2.json();
                if (ipData2 && ipData2.status === 'success' && ipData2.countryCode) {
                  const countryCode = ipData2.countryCode.toUpperCase();
                  const langMapping: Record<string, LanguageCode> = {
                    'SA': 'ar', 'AE': 'ar', 'QA': 'ar', 'EG': 'ar', 'DZ': 'ar', 'JO': 'ar', 'LB': 'ar', 'OM': 'ar', 'YE': 'ar', 'IQ': 'ar', 'KW': 'ar', 'BH': 'ar',
                    'FR': 'fr', 'CA': 'fr', 'CD': 'fr', 'CG': 'fr', 'CI': 'fr', 'SN': 'fr', 'NE': 'fr', 'ML': 'fr',
                    'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'CL': 'es', 'PE': 'es', 'VE': 'es',
                    'PT': 'pt', 'BR': 'pt', 'AO': 'pt', 'MZ': 'pt',
                    'CN': 'zh',
                    'IN': 'hi',
                    'RU': 'ru',
                    'NG': 'en',
                    'KE': 'sw', 'TZ': 'sw', 'UG': 'sw'
                  };
                  const detectedL = langMapping[countryCode] || 'en';
                  setCurrentLang(detectedL);
                  localStorage.setItem('cryptobtc_miner_lang', detectedL);
                }
              }
            }
          } catch (err) {
            console.warn('Visitor location lookup failed:', err);
          }
        }

        // If they are not logged in, decode the path and force login for protected section paths
        const urlPath = window.location.pathname;
        const decoded = decodePath(urlPath, false);
        setCurrentPage(decoded.currentPage);
        setDashboardTab(decoded.dashboardTab);
        if (decoded.isDepositModalOpen !== undefined) {
          setIsDepositModalOpen(decoded.isDepositModalOpen);
        }
      }
    };
    checkSession();

    return () => clearInterval(btcInterval);
  }, []);

  // Poll dashboard notifications and balance updates while logged in
  useEffect(() => {
    if (!isLoggedIn) return;
    
    // Refresh and persist dashboard mining assets with the backend every 15 seconds
    const statsInterval = setInterval(() => {
      loadDashboardAssets();
    }, 15000);

    return () => clearInterval(statsInterval);
  }, [isLoggedIn]);

  const loadPlans = async () => {
    try {
      const res = await api.getPlans();
      setPlans(res);
    } catch (e) {
      console.error('Failed to pre-load plans templates.');
    }
  };

  const loadBtcPrice = async () => {
    try {
      const res = await api.getBtcPrice();
      setBtcPrice(res);
    } catch (e) {
      console.warn('Coin market rates proxy is temporarily using fallback price:', e);
    }
  };

  const loadDashboardAssets = async () => {
    try {
      // Fetch latest profile state to keep balance ticking live
      const prof = await api.getProfile();
      setUserProfile(prof);

      const txList = await api.getTransactions();
      setTransactions(txList);

      const annList = await api.getAnnouncements();
      setAnnouncements(annList);

      const notList = await api.getNotifications();
      setNotifications(notList);
    } catch (e) {
      console.error('Error syncing dynamic dashboard elements:', e);
    }
  };

  // --- ACTIONS HANDLERS ---
  const handleLanguageChange = async (lang: LanguageCode) => {
    setCurrentLang(lang);
    localStorage.setItem('cryptobtc_miner_lang', lang);
    if (isLoggedIn) {
      try {
        const updateRes = await api.saveLanguage(lang);
        if (updateRes && updateRes.profile) {
          setUserProfile(updateRes.profile);
        }
      } catch (err) {
        console.warn('Unable to persist manual language update to server:', err);
      }
    }
  };

  const handleSignOut = () => {
    clearToken();
    setIsLoggedIn(false);
    setUserProfile(null);
    setCurrentPage('home');
    triggerToast('Logged out of your mining session successfully.', 'success');
  };

  // Mark notifications read
  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.readNotifications();
      loadDashboardAssets();
      triggerToast('All notifications cleared.', 'success');
    } catch (e) {
      triggerToast('Could not clear notifications.', 'error');
    }
  };

  // Trigger deposit modal or balance activation for a chosen plan
  const handleSelectPlanLaunchDeposit = async (plan: Plan) => {
    if (!isLoggedIn) {
      if (plan.price_btc === 0) {
        setCurrentPage('register');
      } else {
        setCurrentPage('login');
        triggerToast('Please sign in to your mining account to buy paid hashpower contracts.', 'success');
      }
      return;
    }

    if (plan.price_btc === 0) {
      try {
        const response = await api.activatePlan(plan.id);
        triggerToast(response.message || 'Free starter plan successfully activated!', 'success');
        loadDashboardAssets(); // reload profile & balance
      } catch (err: any) {
        triggerToast(err.message || 'Could not activate Free plan.', 'error');
      }
      return;
    }

    // IsLoggedIn: Paid plan. Offer direct balance purchase if enough balance, or external invoices
    const btcRate = btcPrice?.btc_usd || 68420;
    const priceInBtc = plan.price_btc / btcRate;
    if (userProfile && userProfile.btc_balance >= priceInBtc) {
      const confirmPurchase = window.confirm(
        `You have enough account balance (${userProfile.btc_balance.toFixed(8)} BTC) to activate the ${plan.name} plan directly.\n\n` +
        `Would you like to purchase and activate the ${plan.name} miner right now for ${priceInBtc.toFixed(6)} BTC (equivalent to $${plan.price_btc.toLocaleString()} USDT)? \n` +
        `(Duration: ${plan.duration_days} Days, Hash power: ${plan.hash_rate})\n\n` +
        `Press OK to purchase instantly using your balance, or Cancel to open the deposit/pay external invoice modal.`
      );
      if (confirmPurchase) {
        try {
          const response = await api.activatePlan(plan.id);
          triggerToast(response.message || `${plan.name} miner has been successfully activated using your balance!`, 'success');
          loadDashboardAssets(); // refresh user wallet balance and views
          return;
        } catch (err: any) {
          triggerToast(err.message || 'Could not complete balance purchase.', 'error');
        }
      }
    }

    // IsLoggedIn: Open invoice/deposit modal instead
    setSelectedPlanForDeposit(plan);
    setIsDepositModalOpen(true);
  };

  // After deposit confirms, update balance
  const handleDepositConfirmed = () => {
    setIsDepositModalOpen(false);
    setSelectedPlanForDeposit(null);
    loadDashboardAssets();
  };

  // --- MOCK TIDIO CHATBOT BOT RESPONSES ---
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg, time: timeStr }]);
    setChatInput('');
    setIsChatTyping(true);

    // Chatbot response selection block
    setTimeout(() => {
      setIsChatTyping(false);
      let responseText = "I have recorded your request. Our support staff has been alerted and is typing a response. You'll hear back in a few seconds!";
      const lower = userMsg.toLowerCase();
      
      if (lower.includes('deposit') || lower.includes('pay') || lower.includes('invoice')) {
        responseText = "To purchase a paid contract, click 'Buy Plan' on any card inside your dashboard. It raises an automated NOWPayments invoice displaying a dedicated USDT receiving address + barcode.";
      } else if (lower.includes('withdraw') || lower.includes('cashout') || lower.includes('receive')) {
        responseText = "Minimum withdrawal is 0.0001 BTC. Submit requests in the Withdraw panel. Transactions clear in 1-4 hours following security compliance checks.";
      } else if (lower.includes('payout') || lower.includes('mine') || lower.includes('daily')) {
        responseText = "Miner nodes payout dividends incrementally every 2 minutes. You can monitor actual earnings ticking live on your overview charts.";
      } else if (lower.includes('comrade') || lower.includes('abutanimu')) {
        responseText = "Greetings! Administrator 'comradeabutanimu@gmail.com' operates full supervisor control. If you have any inquiries, they verify platform commands.";
      }

      setChatMessages(prev => [...prev, { sender: 'bot', text: responseText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      playChatPopSound();
    }, 2200);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] font-sans antialiased text-gray-800 flex flex-col justify-between">
      
      {/* GLOW TOP-RIGHT TOAST BANNER */}
      {alertText && (
        <div className={`fixed top-5 right-5 z-100 flex items-center space-x-3 p-4 rounded-xl shadow-2xl border transition-all duration-300 transform translate-y-0 ${
          alertText.type === 'success' 
            ? 'bg-[#1C1917] border-emerald-500 text-white' 
            : 'bg-[#1C1917] border-rose-500 text-white'
        }`}>
          <span>{alertText.type === 'success' ? '✓' : '⚠'}</span>
          <span className="text-xs font-bold">{alertText.msg}</span>
        </div>
      )}

      {/* ===================== VIEW 1: LANDING PAGE AND SIGNUPS ===================== */}
      {currentPage !== 'dashboard' ? (
        <div className="flex-1 flex flex-col min-h-screen">
          <Navbar 
            onNavigate={(page) => {
              if (page === 'dashboard') {
                setCurrentPage('dashboard');
              } else {
                setCurrentPage(page);
              }
            }}
            currentPage={currentPage}
            isLoggedIn={isLoggedIn}
            onLogout={handleSignOut}
            currentLang={currentLang}
            onLanguageChange={handleLanguageChange}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />

          {/* ==================== HOME PAGE LAYOUT ==================== */}
          {currentPage === 'home' && (
            <div className="flex-1 bg-[#070A0F] text-neutral-300 relative overflow-hidden">
              <style>{`
                @keyframes marquee {
                  0% { transform: translateX(0%); }
                  100% { transform: translateX(-50%); }
                }
                @keyframes scanline {
                  0% { transform: translateY(-100%); }
                  100% { transform: translateY(100%); }
                }
                @keyframes pulse-ring {
                  0% { transform: scale(0.95); opacity: 0.5; }
                  50% { transform: scale(1.1); opacity: 0.8; }
                  100% { transform: scale(0.95); opacity: 0.5; }
                }
              `}</style>

              {/* BACKGROUND PARTICLES AND MESH LAYER */}
              <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-gradient-radial from-[#F97316]/10 via-[#ea580c]/5 to-transparent rounded-full filter blur-[120px]" />
                <div className="absolute -right-[15%] top-[20%] w-[50%] h-[50%] bg-gradient-radial from-amber-500/10 via-yellow-600/5 to-transparent rounded-full filter blur-[100px]" />
                <div className="absolute left-[30%] top-[60%] w-[45%] h-[45%] bg-gradient-radial from-orange-600/5 via-transparent to-transparent rounded-full filter blur-[140px]" />
                {/* Tech grid mask */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:40px_40px] opacity-70" />
              </div>

              {/* HERO SECTION */}
              <section className="relative z-10 pt-20 pb-16 sm:pt-28 sm:pb-24 border-b border-[#1C212E]/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-10">
                  
                  {/* Banner LIVE Mining badge */}
                  <div className="inline-flex items-center space-x-2 bg-[#F97316]/10 border border-[#F97316]/30 text-[#F97316] px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F97316] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F97316]"></span>
                    </span>
                    <span>Mining Nodes Live · 524 PH/s pool hash</span>
                  </div>

                  {/* Core H1 Header Display typography */}
                  <div className="space-y-4">
                    <h1 className="text-4xl sm:text-[76px] font-black text-white tracking-tight leading-[0.95] max-w-5xl mx-auto">
                      Enterprise-Grade <br />
                      <span className="bg-gradient-to-r from-[#F97316] via-amber-500 to-[#FEE2E2] bg-clip-text text-transparent">Bitcoin Cloud Hashing</span>
                    </h1>
                    <p className="max-w-3xl mx-auto text-base sm:text-lg text-neutral-400 font-medium leading-relaxed">
                      Instant access to state-of-the-art ASIC mining grids without the noise, heat, or soaring energy bills. Pick a target contract, fund securely, and watch mining rewards payout daily.
                    </p>
                  </div>

                  {/* Hero Actions Rounded Pills */}
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4 max-w-sm sm:max-w-md mx-auto">
                    <button
                      onClick={() => setCurrentPage('register')}
                      className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 font-bold text-sm text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all cursor-pointer text-center"
                    >
                      Start Hashing Now
                    </button>
                    <button
                      onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}
                      className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#12161F] hover:bg-[#1A202C] border border-[#252A36] font-bold text-sm text-white shadow-sm transition-all cursor-pointer text-center"
                    >
                      Browse Contracts
                    </button>
                  </div>

                  {/* TRUST BADGES ROW */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 max-w-4xl mx-auto">
                    <div className="flex items-center space-x-3 bg-[#0C0E14]/70 border border-[#1C212E] p-4 rounded-xl text-left backdrop-blur-md">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">SSL Secured Network</h4>
                        <p className="text-[11px] text-neutral-500 leading-tight">Bank-grade encrypted endpoints</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 bg-[#0C0E14]/70 border border-[#1C212E] p-4 rounded-xl text-left backdrop-blur-md">
                      <div className="w-10 h-10 rounded-lg bg-[#F97316]/10 flex items-center justify-center text-[#F97316] shrink-0">
                        <Lock className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">256-Bit Hardware Encrypted</h4>
                        <p className="text-[11px] text-neutral-500 leading-tight">Secured isolation key systems</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 bg-[#0C0E14]/70 border border-[#1C212E] p-4 rounded-xl text-left backdrop-blur-md">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Licensed & Regulated</h4>
                        <p className="text-[11px] text-neutral-500 leading-tight">UK House Broker No. 14392019</p>
                      </div>
                    </div>
                  </div>

                  {/* INSTITUTIONAL LIVE STATISTICS BAR */}
                  <div className="pt-8">
                    <div className="bg-[#0C0E14]/90 border border-t border-[#1C212E] rounded-2xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#1C212E] overflow-hidden p-6 shadow-xl">
                      <div className="p-4 text-center">
                        <span className="block text-2xl sm:text-3.5xl font-extrabold text-[#F97316] tracking-tight leading-none mb-2 font-mono">
                          198,740+
                        </span>
                        <span className="block text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest">
                          Global Cloud Users
                        </span>
                      </div>
                      <div className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5 mb-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                          <span className="text-2xl sm:text-3.5xl font-extrabold text-white tracking-tight leading-none font-mono">
                            {liveBtcMined.toFixed(8)}
                          </span>
                        </div>
                        <span className="block text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest">
                          Total BTC Solved & Distributed
                        </span>
                      </div>
                      <div className="p-4 text-center">
                        <span className="block text-2xl sm:text-3.5xl font-extrabold text-white tracking-tight leading-none mb-2 font-mono text-emerald-400">
                          99.98%
                        </span>
                        <span className="block text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest">
                          Operations Uptime Audit
                        </span>
                      </div>
                      <div className="p-4 text-center">
                        <span className="block text-2xl sm:text-3.5xl font-extrabold text-white tracking-tight leading-none mb-2 font-mono">
                          48,229
                        </span>
                        <span className="block text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest">
                          Active Mining Rigs
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              </section>

              {/* SOCIAL PROOF SCROLLING TICKER */}
              <div className="bg-[#0A0C11] border-b border-[#1C212E]/80 py-4 overflow-hidden relative z-20">
                <div className="flex whitespace-nowrap animate-[marquee_50s_linear_infinite] gap-12 items-center">
                  {[
                    { user: 'John D.', country: '🇺🇸 USA', amount: '0.0045 BTC', time: '1 min ago' },
                    { user: 'Aisha K.', country: '🇳🇬 Nigeria', amount: '0.0128 BTC', time: '2 mins ago' },
                    { user: 'Hiroshi M.', country: '🇯🇵 Japan', amount: '0.0094 BTC', time: '5 mins ago' },
                    { user: 'Mateo S.', country: '🇪🇸 Spain', amount: '0.0210 BTC', time: '7 mins ago' },
                    { user: 'Elena B.', country: '🇨🇦 Canada', amount: '0.0035 BTC', time: '9 mins ago' },
                    { user: 'David W.', country: '🇬🇧 United Kingdom', amount: '0.0155 BTC', time: '12 mins ago' },
                    { user: 'Carlos P.', country: '🇧🇷 Brazil', amount: '0.0068 BTC', time: '15 mins ago' },
                    { user: 'Amara C.', country: '🇿🇦 South Africa', amount: '0.0112 BTC', time: '18 mins ago' }
                  ].concat([
                    { user: 'John D.', country: '🇺🇸 USA', amount: '0.0045 BTC', time: '1 min ago' },
                    { user: 'Aisha K.', country: '🇳🇬 Nigeria', amount: '0.0128 BTC', time: '2 mins ago' },
                    { user: 'Hiroshi M.', country: '🇯🇵 Japan', amount: '0.0094 BTC', time: '5 mins ago' },
                    { user: 'Mateo S.', country: '🇪🇸 Spain', amount: '0.0210 BTC', time: '7 mins ago' },
                    { user: 'Elena B.', country: '🇨🇦 Canada', amount: '0.0035 BTC', time: '9 mins ago' },
                    { user: 'David W.', country: '🇬🇧 United Kingdom', amount: '0.0155 BTC', time: '12 mins ago' },
                    { user: 'Carlos P.', country: '🇧🇷 Brazil', amount: '0.0068 BTC', time: '15 mins ago' },
                    { user: 'Amara C.', country: '🇿🇦 South Africa', amount: '0.0112 BTC', time: '18 mins ago' }
                  ]).map((item, idx) => (
                    <div key={idx} className="inline-flex items-center space-x-3 text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="text-neutral-300 font-bold">{item.user} ({item.country})</span>
                      <span className="text-neutral-500 font-medium">withdrew</span>
                      <span className="text-[#F97316] font-mono font-bold text-sm bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">{item.amount}</span>
                      <span className="text-neutral-500 text-[10px]">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* LIVE CONSOLE AND CLIENT PERFORMANCE SANDBOX */}
              <section className="py-20 border-b border-[#1C212E]/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    
                    {/* Live mining activity sandbox simulation */}
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <span className="text-xs uppercase font-extrabold tracking-widest text-[#F97316] bg-orange-500/10 px-3 py-1.5 rounded-md">Live Platform Activity</span>
                        <h2 className="text-3xl sm:text-4.5xl font-extrabold tracking-tight text-white leading-tight">ASIC Cluster Proof Verification</h2>
                        <p className="text-neutral-400 text-sm leading-relaxed">
                          Watch block rewards and target mining proofs solved. Our cluster handles custom NOWPayments blockchain relays natively to optimize your miners' security daily.
                        </p>
                      </div>

                      {/* Mock Terminal console simulation */}
                      <div className="bg-[#0C0E14] border border-[#252A36] rounded-2xl p-5 shadow-2xl relative overflow-hidden font-mono text-[11px] text-neutral-300">
                        <div className="absolute top-0 right-0 left-0 bg-[#12161F]/60 border-b border-[#252A36] px-4 py-2.5 flex justify-between items-center">
                          <div className="flex space-x-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                          </div>
                          <span className="text-neutral-500 text-[10px] font-bold">ASIC-LOGS_CONSOLE_LIVE</span>
                        </div>
                        <div className="pt-8 space-y-2.5 max-h-[190px] overflow-hidden leading-relaxed">
                          <p className="text-neutral-500">[INFO] Connecting active container cluster at London Level 27 (UK)...</p>
                          <p className="text-emerald-400">● [SOLVED] Nonce validation match: 0xc18258b3a09e1</p>
                          <p className="text-neutral-400">Node block reward distributed count: <span className="text-orange-500">0.00318290 BTC</span></p>
                          <p className="text-neutral-500">[INFO] Platform state hash: 524 PH/s · Temperature: 54°C</p>
                          <p className="text-emerald-400">● [SOLVED] Nonce validation match: 0xda20268abf021e</p>
                          <p className="text-[#F97316] blink animate-pulse">● [MINING] Syncing with Supabase & NOWPayments secure vaults...</p>
                        </div>
                      </div>
                    </div>

                    {/* FIVE STAR USER REVIEWS GRID WITH PIC UTILS */}
                    <div className="grid grid-cols-1 gap-6">
                      
                      {/* Review 1 */}
                      <div className="bg-[#0C0E14] border border-[#1C212E] p-6 rounded-2xl space-y-4 shadow-lg hover:border-[#F97316]/30 transition-all">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <img 
                              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80" 
                              alt="Marcus T." 
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-full object-cover border border-[#252A36]" 
                            />
                            <div>
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Marcus T.</h4>
                              <span className="text-[10px] text-neutral-500 block mt-0.5">Miner Client since 2023 · USA</span>
                            </div>
                          </div>
                          <div className="flex text-amber-500">
                            {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-500 stroke-none" />)}
                          </div>
                        </div>
                        <p className="text-sm text-neutral-400 leading-relaxed italic">
                          "I was incredibly skeptical of cloud mining platforms, but the node rewards credit like clockwork. Increasing my contract term to a Pro hashing plan worked without hitch."
                        </p>
                      </div>

                      {/* Review 2 */}
                      <div className="bg-[#0C0E14] border border-[#1C212E] p-6 rounded-2xl space-y-4 shadow-lg hover:border-[#F97316]/30 transition-all">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <img 
                              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80" 
                              alt="Aisha K." 
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-full object-cover border border-[#252A36]" 
                            />
                            <div>
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Aisha K.</h4>
                              <span className="text-[10px] text-neutral-500 block mt-0.5">Active Hashing Client · Nigeria</span>
                            </div>
                          </div>
                          <div className="flex text-amber-500">
                            {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-500 stroke-none" />)}
                          </div>
                        </div>
                        <p className="text-sm text-neutral-400 leading-relaxed italic">
                          "Accrued wallet values cash out cleanly without early penalty. The setup process is remarkably simple and the custom sandbox credits allow you to test payouts fast."
                        </p>
                      </div>

                    </div>

                  </div>
                </div>
              </section>

              {/* WHY CHOOSE US SECTION / FEATURES */}
              <section className="py-20 border-b border-[#1C212E]/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
                  <div className="text-center space-y-3.5">
                    <span className="text-xs uppercase font-extrabold tracking-widest text-[#F97316] bg-orange-500/10 px-3 py-1.5 rounded-md">Our Features</span>
                    <h2 className="text-3xl sm:text-4.5xl font-extrabold tracking-tight text-white leading-none">Why Choose CryptoBTC Miner?</h2>
                    <p className="text-neutral-400 text-sm max-w-xl mx-auto leading-relaxed">
                      We operate a professional physical GPU and ASIC data facility. Skip the complex setups and secure your passive yields safely.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-[#0C0E14] border border-[#1C212E] p-8 rounded-2xl hover:border-[#F97316]/40 transition-all space-y-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-[#F97316]">
                        <Cpu className="h-6 w-6" />
                      </div>
                      <h3 className="text-base font-bold text-white uppercase tracking-wider">Premium ASIC Hardware</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Industry-best liquid-cooled Bitmain rigs. Constant structural maintenance ensures maximum efficiency ratios.
                      </p>
                    </div>

                    <div className="bg-[#0C0E14] border border-[#1C212E] p-8 rounded-2xl hover:border-[#F97316]/40 transition-all space-y-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Zap className="h-6 w-6" />
                      </div>
                      <h3 className="text-base font-bold text-white uppercase tracking-wider">Accrued rewards hourly</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Watch block hashes translate into valid wallet balances in real-time. Transparent ledger and zero hidden handling fees.
                      </p>
                    </div>

                    <div className="bg-[#0C0E14] border border-[#1C212E] p-8 rounded-2xl hover:border-[#F97316]/40 transition-all space-y-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <h3 className="text-base font-bold text-white uppercase tracking-wider">Multi-Factor Security</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Secure 2FA authentication, permanent IP change tracking logs, and deep insulated wallet reserves.
                      </p>
                    </div>

                    <div className="bg-[#0C0E14] border border-[#1C212E] p-8 rounded-2xl hover:border-[#F97316]/40 transition-all space-y-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <LineChart className="h-6 w-6" />
                      </div>
                      <h3 className="text-base font-bold text-white uppercase tracking-wider">Scalable plans</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        From startup hashing targets to advanced mining contracts with customizable hash capacities and term selections.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* HOW IT WORKS SECTION */}
              <section className="py-20 border-b border-[#1C212E]/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
                  <div className="text-center space-y-3.5">
                    <span className="text-xs uppercase font-extrabold tracking-widest text-[#F97316] bg-orange-500/10 px-3 py-1.5 rounded-md">Workflow</span>
                    <h2 className="text-3xl sm:text-4.5xl font-extrabold tracking-tight text-white leading-none">How It Works</h2>
                    <p className="text-neutral-400 text-sm max-w-md mx-auto">
                      Earn active Bitcoin in 3 straightforward steps with absolutely zero technical overheads.
                    </p>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-10">
                    
                    {/* Step 1 */}
                    <div className="flex-1 bg-[#0C0E14] border border-[#1C212E] p-8 rounded-2xl space-y-4 relative w-full hover:border-[#F97316]/40 transition-all">
                      <span className="absolute -top-4 -left-4 w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-extrabold flex items-center justify-center shadow-lg shadow-orange-500/20 text-sm">
                        01
                      </span>
                      <h3 className="text-base font-bold text-white uppercase tracking-wider pt-2">Create Account</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Register standard details inside our triple-shielded user portal. Real-time verification is processed instantly to allocate user mining blocks.
                      </p>
                    </div>

                    {/* Animated Arrow 1 */}
                    <div className="hidden md:flex items-center text-[#F97316] shrink-0">
                      <ArrowRight className="h-6 w-6 animate-[pulse-ring_2s_infinite]" />
                    </div>

                    {/* Step 2 */}
                    <div className="flex-1 bg-[#0C0E14] border border-[#1C212E] p-8 rounded-2xl space-y-4 relative w-full hover:border-[#F97316]/40 transition-all">
                      <span className="absolute -top-4 -left-4 w-10 h-10 rounded-xl bg-gradient-to-r from-[#F97316] to-amber-600 text-white font-extrabold flex items-center justify-center shadow-lg shadow-orange-500/20 text-sm">
                        02
                      </span>
                      <h3 className="text-base font-bold text-white uppercase tracking-wider pt-2">Choose Plan & Deposit</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Pick from starter to high-yield custom hashing schedules. Deposit standard USDT utilizing fast secure NOWPayments wallet portals.
                      </p>
                    </div>

                    {/* Animated Arrow 2 */}
                    <div className="hidden md:flex items-center text-[#F97316] shrink-0">
                      <ArrowRight className="h-6 w-6 animate-[pulse-ring_2s_infinite]" />
                    </div>

                    {/* Step 3 */}
                    <div className="flex-1 bg-[#0C0E14] border border-[#1C212E] p-8 rounded-2xl space-y-4 relative w-full hover:border-[#F97316]/40 transition-all">
                      <span className="absolute -top-4 -left-4 w-10 h-10 rounded-xl bg-gradient-to-r from-[#F97316] to-amber-600 text-white font-extrabold flex items-center justify-center shadow-lg shadow-orange-500/20 text-sm">
                        03
                      </span>
                      <h3 className="text-base font-bold text-white uppercase tracking-wider pt-2">Earn Daily BTC</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        ASICs activate block validation rewards instantly. Accumulating yields credit straight to user balances with manual security checkouts.
                      </p>
                    </div>

                  </div>
                </div>
              </section>

              {/* SECURITY ASSURANCES DETAIL */}
              <section className="py-20 border-b border-[#1C212E]/80 bg-[#0A0C11]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="bg-gradient-to-r from-orange-950/40 to-[#0C0E14] border border-[#1C212E] rounded-3xl p-8 sm:p-14 flex flex-col lg:flex-row items-center justify-between gap-10">
                    <div className="space-y-4 max-w-xl">
                      <span className="text-[10px] uppercase font-mono font-extrabold tracking-widest text-[#F97316] bg-orange-500/10 px-2.5 py-1 rounded">Secured Environment</span>
                      <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">Institutional Cold Storage Isolation</h2>
                      <p className="text-neutral-400 text-sm leading-relaxed">
                        We custody client payouts inside high-grade physical multisig cold vaults. All incoming funds are tracked by automated risk tools to shield user mining assets from server interference.
                      </p>
                    </div>
                    <div className="w-full lg:w-auto shrink-0 bg-[#12161F]/85 border border-[#252A36] p-6 rounded-2xl text-center space-y-4 max-w-xs mx-auto lg:mx-0">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 mx-auto">
                        <ShieldCheck className="h-7 w-7" />
                      </div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Triple-Shield Verification</h4>
                      <p className="text-[11px] text-neutral-500 leading-normal">
                        Every system payout mandates distinct isolated database handshakes to prevent compromise.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* MINING PLANS SECTION */}
              <section id="plans" className="py-20 border-b border-[#1C212E]/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                  <div className="text-center space-y-3.5">
                    <span className="text-xs uppercase font-extrabold tracking-widest text-[#F97316] bg-orange-500/10 px-3 py-1.5 rounded-md">Live Pricing</span>
                    <h2 className="text-3xl sm:text-4.5xl font-extrabold tracking-tight text-white leading-none">Pick Your Hashing Contract</h2>
                    <p className="text-sm text-neutral-400 max-w-sm mx-auto leading-relaxed">
                      Zero hidden block maintenance surcharges. Transparent tariffs clearly detailed below.
                    </p>
                  </div>

                  {plans.length > 0 ? (
                    <Plans 
                      plans={plans}
                      onSelectPlan={handleSelectPlanLaunchDeposit}
                      isDashboard={false}
                    />
                  ) : (
                    <div className="text-center py-20">
                      <svg className="animate-spin h-8 w-8 text-orange-500 mx-auto" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                </div>
              </section>

              {/* PARTNERS SECTION */}
              <section className="py-16 border-b border-[#1C212E]/80 bg-[#0A0C11]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                  <div className="text-center">
                    <span className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest block mb-1">Ecosystem Relationship network</span>
                    <h3 className="text-base font-bold text-neutral-400 uppercase tracking-widest">Our Global Strategic Partners</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-6 items-center text-center">
                    {[
                      { name: 'BITMAIN', logo: '⛏️' },
                      { name: 'BINANCE API', logo: '🔶' },
                      { name: 'NICEHASH', logo: '⭐' },
                      { name: 'COINBASE PRO', logo: '🔵' },
                      { name: 'F2POOL', logo: '⚡' },
                      { name: 'ANTPOOL', logo: '🔗' }
                    ].map((partner, idx) => (
                      <div key={idx} className="bg-[#12161F]/40 border border-[#1C212E]/70 rounded-xl py-5 px-4 flex flex-col items-center justify-center space-y-2 hover:border-[#F97316]/30 hover:bg-[#12161F]/80 transition-all cursor-crosshair">
                        <span className="text-2xl">{partner.logo}</span>
                        <span className="text-[10px] font-black text-neutral-400 font-sans tracking-widest block uppercase">{partner.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* FAQ SECTION Accordion */}
              <section id="faq" className="py-20 border-b border-[#1C212E]/80">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">Frequently Answered Queries</h2>
                    <p className="text-sm text-neutral-400">Get instant clarification on operational terms and withdrawals</p>
                  </div>

                  <div className="space-y-4">
                    {[
                      { q: 'Is there any minimum deposit sum?', a: 'Standard deposits initiate at 500 USDT to purchase mining nodes. Custom sandbox invoices can use test amounts starting at 10 USDT.' },
                      { q: 'Can I terminate mining contracts early?', a: 'Clouds contracts are locked for plan durations (30 to 180 days) as we allocate active ASIC computer cards physically in containers.' },
                      { q: 'How is security maintained against web leaks?', a: 'Client logins, and wallets databases operate behind TLS tunnels. Critical balances are securely isolated.' }
                    ].map((item, index) => {
                      const isOpen = landingFaqIndex === index;
                      return (
                        <div key={index} className="bg-[#0C0E14] border border-[#1C212E] rounded-2xl overflow-hidden hover:bg-[#12161F] hover:border-[#F97316]/20 transition-all duration-200">
                          <button
                            onClick={() => setLandingFaqIndex(isOpen ? null : index)}
                            className="w-full text-left p-5 text-sm font-bold text-white flex justify-between items-center cursor-pointer"
                          >
                            <span>{item.q}</span>
                            <ChevronDown className={`h-4 w-4 text-[#F97316] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {isOpen && (
                            <div className="px-5 pb-5 pt-1 text-xs text-neutral-400 leading-relaxed font-semibold">
                              {item.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* CTA BANNER */}
              <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 relative">
                <div className="bg-gradient-to-r from-orange-950/40 via-neutral-950 to-orange-950/20 rounded-3xl p-8 sm:p-16 text-center text-white space-y-6 border border-[#1C212E] shadow-2xl relative overflow-hidden">
                  <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent opacity-70" />
                  <h2 className="text-3.5xl sm:text-5xl font-black tracking-tight leading-none text-white">Start earning Bitcoin today</h2>
                  <p className="text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
                    Register in minutes, deposit securely, and launch active block hashing nodes instantly. Join the top crypto yields portal now.
                  </p>
                  <button
                    onClick={() => setCurrentPage('register')}
                    className="inline-flex px-8 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 font-bold text-sm text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all cursor-pointer text-center"
                  >
                    Create Free Account
                  </button>
                </div>
              </section>

            </div>
          )}

          {/* ==================== REGISTER VIEW ==================== */}
          {currentPage === 'register' && (
            <div className="flex-1 py-16 px-4 bg-[#FAFAF9] flex items-center justify-center">
              <div className="bg-white rounded-3xl border border-[#E7E7E4] shadow-xl max-w-md w-full p-8 space-y-6">
                
                {signupStep === 'details' ? (
                  <>
                    {/* Logo and texts */}
                    <div className="text-center space-y-2">
                      <div className="w-11 h-11 bg-[#F97316] rounded-full flex items-center justify-center shadow-xs mx-auto">
                        <span className="text-white text-2xl font-bold">₿</span>
                      </div>
                      <h2 className="text-2xl font-extrabold text-[#1A1A1A] tracking-tight">Create your account</h2>
                      <p className="text-xs text-gray-400">Start mining BTC in minutes with zero technical overhead.</p>
                    </div>

                    {/* Form parameters */}
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (isSignupDetailsLoading) return;
                        setIsSignupDetailsLoading(true);
                        const formdata = new FormData(e.currentTarget);
                        const name = formdata.get('name') as string;
                        const email = formdata.get('email') as string;
                        const password = formdata.get('password') as string;
                        const referralCode = formdata.get('referral') as string;

                        try {
                          // Save fields to state for resending OTPs
                          setSignupName(name);
                          setSignupEmail(email);
                          setSignupPassword(password);
                          setSignupReferral(referralCode);

                          // Step 1: Request OTP validation first
                          await api.sendSignupOtp({ name, email, password, referralCode });
                          setSignupCodeInput('');
                          setSignupStep('otp');
                          setSignupResendTimer(30); // Start Resend countdown immediately
                          triggerToast('Verification OTP generated and sent to email!', 'success');
                        } catch (err: any) {
                          triggerToast(err.message || 'Error initiating account signup.', 'error');
                        } finally {
                          setIsSignupDetailsLoading(false);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Full Name</label>
                        <input type="text" name="name" required placeholder="Marcus Aurelius" className="w-full px-4 py-2.5 border border-[#E7E7E4] rounded-xl focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/10 text-xs font-semibold text-[#1A1A1A]" />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Email Address</label>
                        <input type="email" name="email" required placeholder="example@email.com" className="w-full px-4 py-2.5 border border-[#E7E7E4] rounded-xl focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/10 text-xs font-semibold text-[#1A1A1A]" />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Secure Password</label>
                        <div className="relative">
                          <input
                            type={showRegPassword ? "text" : "password"}
                            name="password"
                            required
                            placeholder="••••••••"
                            className="w-full pl-4 pr-10 py-2.5 border border-[#E7E7E4] rounded-xl focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/10 text-xs font-semibold text-[#1A1A1A]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 cursor-pointer focus:outline-hidden"
                          >
                            {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Referral Code (Optional)</label>
                        <input type="text" name="referral" placeholder="e.g. BTC420" className="w-full px-4 py-2.5 border border-[#E7E7E4] rounded-xl focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/10 text-xs font-mono font-bold text-[#1A1A1A]" />
                      </div>

                      <button
                        type="submit"
                        disabled={isSignupDetailsLoading}
                        className="w-full py-3.5 px-4 bg-[#F97316] hover:bg-[#EA580C] rounded-full font-bold text-white text-xs cursor-pointer shadow-xs hover:shadow-md transition-all text-center flex items-center justify-center space-x-2 disabled:bg-orange-500/65 disabled:cursor-not-allowed select-none"
                      >
                        {isSignupDetailsLoading ? (
                          <>
                            <Loader className="animate-spin h-3.5 w-3.5" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <span>Request registration OTP code</span>
                        )}
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    {/* OTP Form Header */}
                    <div className="text-center space-y-2">
                      <div className="w-11 h-11 bg-orange-100/50 text-[#F97316] rounded-full flex items-center justify-center mx-auto shadow-xs">
                        <span className="text-xl font-bold">🔒</span>
                      </div>
                      <h2 className="text-2xl font-extrabold text-[#1A1A1A] tracking-tight text-center">Enter Verification Code</h2>
                      <p className="text-xs text-gray-400 leading-relaxed text-center">
                        We have dispatched a 6-digit authentication OTP to <strong className="text-gray-900">{signupEmail}</strong>. 
                        Please enter the authorization code below.
                      </p>
                    </div>

                    {/* OTP input action */}
                    <div className="space-y-6">
                      <div className="space-y-2 text-center">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">
                          6-Digit Verification OTP
                        </label>
                        
                        <div className="relative w-full max-w-[280px] mx-auto h-14">
                          {/* 6 High-Contrast Segment Boxes */}
                          <div className="flex justify-between gap-2.5 pointer-events-none w-full h-full">
                            {[0, 1, 2, 3, 4, 5].map((index) => {
                              const digit = signupCodeInput.charAt(index);
                              const isFocused = signupCodeInput.length === index;
                              return (
                                <div
                                  key={index}
                                  className={`flex-1 h-full flex items-center justify-center text-2xl font-black font-mono rounded-xl border-2 transition-all ${
                                    isFocused
                                      ? 'border-[#F97316] bg-white text-[#F97316] shadow-sm ring-4 ring-[#F97316]/10'
                                      : digit
                                        ? 'border-gray-300 bg-white text-gray-950'
                                        : 'border-gray-200 bg-[#FAFAF9] text-gray-300'
                                  }`}
                                >
                                  {digit || <span className="text-gray-300/60 font-sans text-lg">•</span>}
                                </div>
                              );
                            })}
                          </div>

                          {/* Invisible actual input covering segments */}
                          <input
                            type="text"
                            pattern="[0-9]{6}"
                            inputMode="numeric"
                            maxLength={6}
                            required
                            autoFocus
                            value={signupCodeInput}
                            onChange={(e) => setSignupCodeInput(e.target.value.replace(/[^0-9]/g, ''))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-center text-lg tracking-[1.5em] focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Info / Fallback OTP Alerts */}
                      <div className="space-y-4">
                        <div className="text-center bg-gray-50 border border-gray-100/80 p-3 rounded-2xl">
                          <p className="text-[11px] text-gray-500 leading-normal">
                            📧 Can't see it? Please check your <strong>Spam / Junk / Promotions</strong> folders since automated delivery codes can sometimes be filtered by Gmail.
                          </p>
                        </div>
                      </div>

                      {/* Resend Action */}
                      <div className="text-center">
                        <button
                          type="button"
                          disabled={signupResendTimer > 0}
                          onClick={handleResendSignupOtp}
                          className={`text-xs font-bold tracking-tight transition-all px-3 py-1.5 rounded-lg inline-flex items-center space-x-1 ${
                            signupResendTimer > 0
                              ? 'text-gray-400 bg-gray-50 cursor-not-allowed border border-gray-100/60'
                              : 'text-[#F97316] hover:text-[#EA580C] hover:bg-orange-50 cursor-pointer'
                          }`}
                        >
                          <span>{signupResendTimer > 0 ? `Resend code in ${signupResendTimer}s` : 'Resend Code'}</span>
                        </button>
                      </div>

                      <button
                        onClick={async () => {
                          if (isSignupOtpLoading) return;
                          if (!signupCodeInput || signupCodeInput.trim().length !== 6) {
                            return triggerToast('Please enter the complete 6-digit OTP code.', 'error');
                          }
                          setIsSignupOtpLoading(true);
                          try {
                            const res = await api.verifySignupOtp({ email: signupEmail, otp: signupCodeInput });
                            setToken(res.token);
                            setUserProfile(res.profile);
                            setIsLoggedIn(true);
                            setSignupStep('details');
                            triggerToast('Email address authenticated successfully! Welcome!', 'success');
                            
                            if (res.profile.is_admin) {
                              setDashboardTab('admin');
                            } else {
                              setDashboardTab('overview');
                            }
                            setCurrentPage('dashboard');
                            loadDashboardAssets();
                          } catch (err: any) {
                            triggerToast(err.message || 'OTP verification declined. Please try again.', 'error');
                          } finally {
                            setIsSignupOtpLoading(false);
                          }
                        }}
                        disabled={isSignupOtpLoading}
                        className="w-full py-3.5 px-4 bg-[#F97316] hover:bg-[#EA580C] rounded-full font-bold text-white text-xs cursor-pointer shadow-xs hover:shadow-md transition-all text-center flex items-center justify-center space-x-2 disabled:bg-orange-500/65 disabled:cursor-not-allowed select-none"
                      >
                        {isSignupOtpLoading ? (
                          <>
                            <Loader className="animate-spin h-3.5 w-3.5" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <span>Verify Code & Start mining</span>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setSignupStep('details');
                        }}
                        className="w-full text-center text-xs font-bold text-gray-500 hover:text-gray-950 transition-colors cursor-pointer"
                      >
                        Go Back
                      </button>
                    </div>
                  </>
                )}

                <div className="text-center border-t border-gray-100 pt-4">
                  <button onClick={() => { setSignupStep('details'); setCurrentPage('login'); }} className="text-xs font-semibold text-gray-500 hover:text-[#F97316] transition-colors">
                    Already have an account? Sign in
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* ==================== LOGIN VIEW ==================== */}
          {/* ==================== LOGIN VIEW ==================== */}
          {currentPage === 'login' && (
            <div className="flex-1 py-16 px-4 bg-[#FAFAF9] flex items-center justify-center">
              <div className="bg-white rounded-3xl border border-[#E7E7E4] shadow-xl max-w-md w-full p-8 space-y-6">
                
                {loginNeeds2fa ? (
                  <>
                    <div className="text-center space-y-2">
                      <div className="w-11 h-11 bg-orange-100/50 text-[#F97316] rounded-full flex items-center justify-center mx-auto shadow-xs">
                        <Smartphone className="h-6 w-6" />
                      </div>
                      <h2 className="text-xl font-extrabold text-[#1A1A1A] tracking-tight">Two-Factor Security</h2>
                      <p className="text-xs text-gray-400">Enter the 6-digit dynamic authentication code currently generated by your authenticator app.</p>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (is2faLoading) return;
                        setIs2faLoading(true);
                        try {
                          const res = await api.verify2FaLogin({
                            email: login2faEmail,
                            password: login2faPassword,
                            code: login2faCode
                          });
                          setToken(res.token);
                          setUserProfile(res.profile);
                          setIsLoggedIn(true);
                          setLoginNeeds2fa(false);
                          setLogin2faCode('');
                          
                          triggerToast('Authenticated through 2FA protection successfully!', 'success');
                          if (res.profile.is_admin) {
                            setDashboardTab('admin');
                          } else {
                            setDashboardTab('overview');
                          }
                          setCurrentPage('dashboard');
                          loadDashboardAssets();
                        } catch (err: any) {
                          triggerToast(err.message || 'The specified 2FA code is invalid.', 'error');
                        } finally {
                          setIs2faLoading(false);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block text-center">6-Digit OTP Code</label>
                        <input
                          type="text"
                          maxLength={6}
                          required
                          autoFocus
                          value={login2faCode}
                          onChange={(e) => setLogin2faCode(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="000000"
                          className="w-full px-4 py-3 border border-[#E7E7E4] rounded-xl focus:border-[#F97316] focus:outline-hidden text-center text-lg font-bold tracking-widest placeholder:tracking-normal placeholder:font-normal"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={login2faCode.length !== 6 || is2faLoading}
                        className="w-full py-3.5 px-4 bg-[#F97316] hover:bg-[#EA580C] rounded-full font-bold text-white text-xs cursor-pointer shadow-xs hover:shadow-md transition-all text-center flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed select-none"
                      >
                        {is2faLoading ? (
                          <>
                            <Loader className="animate-spin h-3.5 w-3.5" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <span>Verify & Secure Access</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setLoginNeeds2fa(false);
                          setLogin2faCode('');
                        }}
                        className="w-full text-center text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        Cancel Verification
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    {/* Header */}
                    <div className="text-center space-y-2">
                      <div className="w-11 h-11 bg-[#F97316] rounded-full flex items-center justify-center shadow-xs mx-auto">
                        <span className="text-white text-2xl font-bold">₿</span>
                      </div>
                      <h2 className="text-2xl font-extrabold text-[#1A1A1A] tracking-tight">Welcome back</h2>
                      <p className="text-xs text-gray-400">Sign in to your mining dashboard.</p>
                    </div>

                    {/* Login forms */}
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (isLoginLoading) return;
                        setIsLoginLoading(true);
                        const formdata = new FormData(e.currentTarget);
                        const email = formdata.get('email') as string;
                        const password = formdata.get('password') as string;

                        try {
                          const res = await api.login({ email, password });
                          if (res.require_2fa) {
                            setLogin2faEmail(email);
                            setLogin2faPassword(password);
                            setLoginNeeds2fa(true);
                            setLogin2faCode('');
                            triggerToast('Security validation required. Please type your 2FA OTP code.', 'success');
                            return;
                          }

                          setToken(res.token);
                          setUserProfile(res.profile);
                          setIsLoggedIn(true);
                          triggerToast('Welcome back to the operations command!', 'success');
                          
                          if (res.profile.is_admin) {
                            setDashboardTab('admin');
                          } else {
                            setDashboardTab('overview');
                          }
                          setCurrentPage('dashboard');
                          loadDashboardAssets();
                        } catch (err: any) {
                          triggerToast(err.message || 'Login details invalid.', 'error');
                        } finally {
                          setIsLoginLoading(false);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Email Address</label>
                        <input type="email" name="email" required placeholder="example@email.com" className="w-full px-4 py-2.5 border border-[#E7E7E4] rounded-xl focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/10 text-xs font-semibold text-[#1A1A1A]" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-gray-400">
                          <label>Secure Password</label>
                          <button
                            type="button"
                            onClick={() => {
                              setResetStep('request');
                              setResetEmail('');
                              setResetCodeInput('');
                              setForgotDeveloperOtp('');
                              setCurrentPage('reset-password');
                            }}
                            className="text-[#F97316] hover:text-[#EA580C] font-semibold hover:underline cursor-pointer"
                          >
                            Forgot?
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showLoginPassword ? "text" : "password"}
                            name="password"
                            required
                            placeholder="••••••••"
                            className="w-full pl-4 pr-10 py-2.5 border border-[#E7E7E4] rounded-xl focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/10 text-xs font-semibold text-[#1A1A1A]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 cursor-pointer focus:outline-hidden"
                          >
                            {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoginLoading}
                        className="w-full py-3.5 px-4 bg-[#F97316] hover:bg-[#EA580C] rounded-full font-bold text-white text-xs cursor-pointer shadow-xs hover:shadow-md transition-all text-center flex items-center justify-center space-x-2 disabled:bg-orange-500/65 disabled:cursor-not-allowed select-none"
                      >
                        {isLoginLoading ? (
                          <>
                            <Loader className="animate-spin h-3.5 w-3.5" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <span>Sign in</span>
                        )}
                      </button>
                    </form>

                    <div className="text-center">
                      <button onClick={() => setCurrentPage('register')} className="text-xs font-semibold text-gray-500 hover:text-[#F97316] transition-colors">
                        New here? Create account
                      </button>
                    </div>
                  </>
                )}

              </div>
            </div>
          )}

          {/* ==================== RESET PASSWORD VIEW ==================== */}
          {currentPage === 'reset-password' && (
            <div className="flex-1 py-16 px-4 bg-[#FAFAF9] flex items-center justify-center">
              <div className="bg-white rounded-3xl border border-[#E7E7E4] shadow-xl max-w-md w-full p-8 space-y-6">
                
                {resetStep === 'request' ? (
                  <>
                    <div className="text-center space-y-2">
                      <div className="w-11 h-11 bg-orange-100/50 text-[#F97316] rounded-full flex items-center justify-center mx-auto shadow-xs">
                        <span className="text-xl font-bold">🔑</span>
                      </div>
                      <h2 className="text-2xl font-extrabold text-[#1A1A1A] tracking-tight">Forgot Password</h2>
                      <p className="text-xs text-gray-400">Request a 6-digit OTP verification code to reset your account credentials safely.</p>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (isResetRequestLoading) return;
                        setIsResetRequestLoading(true);
                        const formdata = new FormData(e.currentTarget);
                        const emailInput = formdata.get('requestEmail') as string;
                        try {
                          await api.forgotPassword(emailInput);
                          setResetEmail(emailInput);
                          setResetCodeInput('');
                          setResetStep('verify');
                          setResetResendTimer(300); // Start Resend countdown immediately
                          triggerToast('Password reset validation code successfully generated!', 'success');
                        } catch (err: any) {
                          triggerToast(err.message || 'Error occurred starting reset process.', 'error');
                        } finally {
                          setIsResetRequestLoading(false);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Registered Email Address</label>
                        <input type="email" name="requestEmail" required placeholder="example@email.com" className="w-full px-4 py-2.5 border border-[#E7E7E4] rounded-xl focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/10 text-xs font-semibold text-[#1A1A1A]" />
                      </div>

                      <button
                        type="submit"
                        disabled={isResetRequestLoading}
                        className="w-full py-3.5 px-4 bg-[#F97316] hover:bg-[#EA580C] rounded-full font-bold text-white text-xs cursor-pointer shadow-xs hover:shadow-md transition-all text-center flex items-center justify-center space-x-2 disabled:bg-orange-500/65 disabled:cursor-not-allowed select-none"
                      >
                        {isResetRequestLoading ? (
                          <>
                            <Loader className="animate-spin h-3.5 w-3.5" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <span>Request Recovery OTP Code</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setCurrentPage('login')}
                        className="w-full text-center text-xs font-bold text-gray-500 hover:text-gray-950 transition-colors cursor-pointer"
                      >
                        Go Back to Sign in
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="text-center space-y-2">
                      <div className="w-11 h-11 bg-orange-100/50 text-[#F97316] rounded-full flex items-center justify-center mx-auto shadow-xs">
                        <span className="text-xl font-bold">🔒</span>
                      </div>
                      <h2 className="text-2xl font-extrabold text-[#1A1A1A] tracking-tight">Setup New Password</h2>
                      <p className="text-xs text-gray-400 leading-relaxed text-center">
                        Please enter the 6-digit code sent to <strong className="text-gray-900">{resetEmail}</strong> along with your new password details.
                      </p>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (isResetVerifyLoading) return;
                        setIsResetVerifyLoading(true);
                        const formdata = new FormData(e.currentTarget);
                        const pass = formdata.get('password') as string;
                        const confirmPass = formdata.get('confirm') as string;

                        if (resetCodeInput.trim().length !== 6) {
                          setIsResetVerifyLoading(false);
                          return triggerToast('Please enter the complete 6-digit verification code.', 'error');
                        }
                        if (pass !== confirmPass) {
                          setIsResetVerifyLoading(false);
                          return triggerToast('Confirm password values mismatched.', 'error');
                        }

                        try {
                          await api.resetPassword({ email: resetEmail, otp: resetCodeInput, password: pass });
                          triggerToast('Security credentials updated successfully! You can now login.', 'success');
                          setResetStep('request');
                          setCurrentPage('login');
                        } catch (err: any) {
                          triggerToast(err.message || 'OTP verification verification error. Please retry.', 'error');
                        } finally {
                          setIsResetVerifyLoading(false);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-2 text-center">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">6-Digit Verification OTP</label>
                        
                        <div className="relative w-full max-w-[280px] mx-auto h-14">
                          {/* 6 High-Contrast Segment Boxes */}
                          <div className="flex justify-between gap-2.5 pointer-events-none w-full h-full">
                            {[0, 1, 2, 3, 4, 5].map((index) => {
                              const digit = resetCodeInput.charAt(index);
                              const isFocused = resetCodeInput.length === index;
                              return (
                                <div
                                  key={index}
                                  className={`flex-1 h-full flex items-center justify-center text-2xl font-black font-mono rounded-xl border-2 transition-all ${
                                    isFocused
                                      ? 'border-[#F97316] bg-white text-[#F97316] shadow-sm ring-4 ring-[#F97316]/10'
                                      : digit
                                        ? 'border-gray-300 bg-white text-gray-950'
                                        : 'border-gray-200 bg-[#FAFAF9] text-gray-300'
                                  }`}
                                >
                                  {digit || <span className="text-gray-300/60 font-sans text-lg">•</span>}
                                </div>
                              );
                            })}
                          </div>

                          {/* Invisible actual input covering segments */}
                          <input
                            type="text"
                            pattern="[0-9]{6}"
                            inputMode="numeric"
                            maxLength={6}
                            required
                            autoFocus
                            value={resetCodeInput}
                            onChange={(e) => setResetCodeInput(e.target.value.replace(/[^0-9]/g, ''))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-center text-lg tracking-[1.5em] focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Resend Action */}
                      <div className="text-center">
                        <button
                          type="button"
                          disabled={resetResendTimer > 0}
                          onClick={handleResendResetOtp}
                          className={`text-xs font-bold tracking-tight transition-all px-3 py-1.5 rounded-lg inline-flex items-center space-x-1 ${
                            resetResendTimer > 0
                              ? 'text-gray-400 bg-gray-50 cursor-not-allowed border border-gray-100/60'
                              : 'text-[#F97316] hover:text-[#EA580C] hover:bg-orange-50 cursor-pointer'
                          }`}
                        >
                          <span>{resetResendTimer > 0 ? `Resend code in ${Math.floor(resetResendTimer / 60)}m ${resetResendTimer % 60}s` : 'Resend Code'}</span>
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">New Password</label>
                        <div className="relative">
                          <input
                            type={showResetPassword ? "text" : "password"}
                            name="password"
                            required
                            placeholder="Min 6 characters"
                            className="w-full pl-4 pr-10 py-2.5 border border-[#E7E7E4] rounded-xl focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/10 text-xs font-semibold text-[#1A1A1A]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetPassword(!showResetPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 cursor-pointer focus:outline-hidden"
                          >
                            {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Confirm Password</label>
                        <div className="relative">
                          <input
                            type={showResetConfirmPassword ? "text" : "password"}
                            name="confirm"
                            required
                            placeholder="Repopulate password"
                            className="w-full pl-4 pr-10 py-2.5 border border-[#E7E7E4] rounded-xl focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/10 text-xs font-semibold text-[#1A1A1A]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 cursor-pointer focus:outline-hidden"
                          >
                            {showResetConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isResetVerifyLoading}
                        className="w-full py-3.5 px-4 bg-[#F97316] hover:bg-[#EA580C] rounded-full font-bold text-white text-xs cursor-pointer shadow-xs hover:shadow-md transition-all text-center flex items-center justify-center space-x-2 disabled:bg-orange-500/65 disabled:cursor-not-allowed select-none"
                      >
                        {isResetVerifyLoading ? (
                          <>
                            <Loader className="animate-spin h-3.5 w-3.5" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <span>Reset password</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setResetStep('request')}
                        className="w-full text-center text-xs font-bold text-gray-500 hover:text-gray-950 transition-colors cursor-pointer"
                      >
                        Request New Code
                      </button>
                    </form>
                  </>
                )}

              </div>
            </div>
          )}

          <Footer onNavigate={setCurrentPage} />
        </div>
      ) : (
        // ===================== VIEW 2: LOGGED-IN USER DASHBOARD CORE =====================
        <div className="flex-1 flex flex-col md:flex-row min-h-screen bg-gray-50/50">
          {/* Dashboard Left Sidebar Desktop layout */}
          <aside className="hidden md:flex w-64 bg-white border-r border-gray-100 flex-col py-6 select-none shrink-0 justify-between">
            <div className="space-y-6">
              {/* Logo block */}
              <div className="px-6 cursor-pointer" onClick={() => setCurrentPage('home')}>
                <div className="flex items-center space-x-2">
                  <div className="w-8.5 h-8.5 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-base font-extrabold">₿</span>
                  </div>
                  <span className="text-lg font-bold tracking-tight">
                    <span className="text-gray-900">CryptoBTC</span>
                    <span className="text-orange-500 ml-1">Miner</span>
                  </span>
                </div>
              </div>

              {/* Sidebar Tabs maps */}
              <nav className="px-4 space-y-1">
                
                {/* Admin first item and orange colored if admin */}
                {userProfile?.is_admin && (
                  <button
                    onClick={() => setDashboardTab('admin')}
                    className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl flex items-center space-x-2.5 cursor-pointer whitespace-nowrap transition-colors ${
                      dashboardTab === 'admin'
                        ? 'bg-[#F97316] text-white shadow-xs'
                        : 'text-orange-600 hover:bg-orange-50/50'
                    }`}
                  >
                    <Shield className="h-4 w-4 shrink-0" />
                    <span>Admin Operations</span>
                  </button>
                )}

                {[
                  { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
                  { id: 'plans', label: 'Miner Plans', icon: <Award className="h-4 w-4" /> },
                  { id: 'transactions', label: 'Transactions', icon: <Clock className="h-4 w-4" /> },
                  { id: 'deposit', label: 'Deposit Funds', icon: <Download className="h-4 w-4" /> },
                  { id: 'withdraw', label: 'Withdrawal', icon: <Upload className="h-4 w-4" /> },
                  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
                  { id: 'activity-logs', label: 'Activity Logs', icon: <Sliders className="h-4 w-4" /> },
                  { id: 'referrals', label: 'Referrals Link', icon: <Users className="h-4 w-4" /> },
                  { id: 'settings', label: 'Account Settings', icon: <SettingsIcon className="h-4 w-4" /> },
                  { id: 'support', label: 'Direct Support', icon: <LifeBuoy className="h-4 w-4" /> }
                ].map((item) => {
                  if (item.id === 'deposit') {
                    return (
                      <button
                        key={item.id}
                        onClick={() => setIsDepositModalOpen(true)}
                        className="w-full px-3 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-950 hover:bg-gray-50 rounded-xl flex items-center space-x-2.5 cursor-pointer transition-colors"
                      >
                        <Download className="h-4 w-4 shrink-0" />
                        <span>Deposit (Modal)</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      onClick={() => setDashboardTab(item.id)}
                      className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl flex items-center space-x-2.5 cursor-pointer transition-colors ${
                        dashboardTab === item.id && (dashboardTab !== 'admin' || !userProfile?.is_admin)
                          ? 'bg-orange-500 text-white shadow-xs'
                          : 'text-gray-500 hover:text-gray-950 hover:bg-gray-50'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Profile widget in sidebar bottom */}
            {userProfile && (
              <div className="px-4 border-t border-gray-100 pt-4 flex flex-col space-y-2">
                <div className="px-3">
                  <span className="text-xs font-bold text-gray-900 block truncate">{userProfile.full_name}</span>
                  <span className="text-[10px] text-gray-400 block truncate mt-0.5">{userProfile.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-gray-400 hover:text-rose-500 hover:bg-rose-50/50 rounded-lg cursor-pointer"
                >
                  Exit Session
                </button>
              </div>
            )}
          </aside>

          {/* Core main workspace center */}
          <main className="flex-1 flex flex-col min-w-0">
            {/* Dashboard top bar */}
            <header className="bg-white border-b border-gray-100 h-16 shrink-0 flex items-center justify-between px-4 sm:px-6">
              <div className="flex items-center space-x-4">
                {/* Mobile drawer click toggle */}
                <button
                  onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                  className="md:hidden p-2 text-gray-650 hover:bg-gray-50 rounded-lg"
                >
                  <Menu className="h-5 w-5" />
                </button>

                {/* Left tab heading title */}
                <h2 className="text-base font-extrabold text-[#111827] capitalize">
                  {dashboardTab.replace('-', ' ')} PANEL
                </h2>
              </div>

              {/* Right side notifications info indicators */}
              <div className="flex items-center space-x-3">
                {/* Theme Toggle Button */}
                <button
                  onClick={handleToggleTheme}
                  className="p-2 text-gray-400 hover:text-orange-500 hover:bg-gray-50 border border-transparent hover:border-gray-150 rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-2xs"
                  title={theme === 'dark' ? "Switch to light/default mode" : "Switch to dark mode"}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-4.5 w-4.5 text-amber-500" />
                  ) : (
                    <Moon className="h-4.5 w-4.5 text-gray-500" />
                  )}
                </button>

                {/* Dashboard Manual Language Selector */}
                <div className="relative flex items-center space-x-1 border border-gray-100 bg-gray-50 rounded-lg px-2 py-1">
                  <Globe className="h-3.5 w-3.5 text-gray-400" />
                  <select
                    value={currentLang}
                    onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
                    className="text-xs font-semibold text-gray-600 bg-transparent border-none focus:outline-hidden cursor-pointer"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {['zh', 'hi', 'ru'].includes(lang.code) ? lang.name.split(' ')[0] : lang.name.substring(0, 3)}
                      </option>
                    ))}
                  </select>
                </div>

                <button 
                  onClick={() => setDashboardTab('notifications')}
                  className="relative p-2 text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <Bell className="h-5 w-5" />
                  {notifications.filter(n => !n.is_read).length > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-orange-500 block ring-2 ring-white"></span>
                  )}
                </button>
              </div>
            </header>

            {/* Dynamic tabs render workspace container */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
              {userProfile && (
                <>
                  {/* 2FA SECURITY ALERT BANNER (FEATURE 3) */}
                  <AnimatePresence>
                    {!userProfile.two_factor_enabled && !dismissed2FaAlert && (
                      <motion.div
                        id="2fa-security-alert-banner"
                        initial={{ opacity: 0, y: -35 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -35 }}
                        transition={{ type: "tween", ease: "easeOut", duration: 0.45 }}
                        className="relative mb-6 p-5 pr-10 sm:p-6 sm:pr-12 bg-rose-50 border border-rose-200 rounded-2xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-left origin-top"
                      >
                        <button
                          id="close-2fa-alert-button"
                          onClick={() => {
                            setDismissed2FaAlert(true);
                            sessionStorage.setItem('cryptobtc_miner_2fa_alert_dismissed_session', 'true');
                          }}
                          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-rose-100 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                          aria-label="Close alert"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="flex items-start space-x-4">
                          <div className="p-3 bg-rose-100 rounded-xl text-rose-600 shrink-0">
                            <ShieldAlert className="h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-rose-950">
                              {t.alert2faTitle}
                            </h4>
                            <p className="text-xs text-rose-800 font-medium mt-1 leading-relaxed max-w-2xl">
                              {t.alert2faBody}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 w-full md:w-auto shrink-0">
                          <button
                            onClick={() => {
                              setInitialSettingsSegment('security');
                              setDashboardTab('settings');
                            }}
                            className="flex-1 md:flex-none px-4 py-2 bg-rose-650 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer text-center whitespace-nowrap"
                          >
                            {t.enable2fa}
                          </button>
                          <button
                            onClick={() => {
                              setDismissed2FaAlert(true);
                              localStorage.setItem('cryptobtc_miner_2fa_alert_dismissed', 'true');
                            }}
                            className="flex-1 md:flex-none px-4 py-2 bg-white hover:bg-rose-100/50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center"
                          >
                            {t.remindLater}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {dashboardTab === 'overview' && (
                    <Overview 
                      profile={userProfile}
                      transactions={transactions}
                      announcements={announcements}
                      btcPrice={btcPrice}
                      plans={plans}
                      onUpdateBlur={(b) => {
                        setUserProfile({ ...userProfile, settings: { ...userProfile.settings, blurBalances: b } });
                        api.updateProfile({ settings: { ...userProfile.settings, blurBalances: b } });
                      }}
                      onNavigate={(tab) => {
                        if (tab === 'deposit') {
                          setIsDepositModalOpen(true);
                        } else {
                          setDashboardTab(tab);
                        }
                      }}
                      onRefreshDashboard={loadDashboardAssets}
                    />
                  )}

                  {dashboardTab === 'plans' && (
                    <div className="w-full min-h-[calc(100vh-180px)] md:min-h-[calc(100vh-140px)] flex flex-col justify-center items-center py-6">
                      <div className="w-full max-w-6xl space-y-8 flex flex-col justify-center">
                        <div className="pb-4 border-b border-gray-100 text-center">
                          <h3 className="text-xl font-extrabold text-neutral-900">Catalogs available paid mining contracts</h3>
                          <p className="text-xs text-gray-400 mt-1">Deploy Starter or VIP hash rates to instantly amplify daily payouts</p>
                        </div>
                        <div className="flex justify-center items-center w-full">
                          <Plans 
                            plans={plans}
                            activePlanId={userProfile.active_plan}
                            onSelectPlan={handleSelectPlanLaunchDeposit}
                            isDashboard={true}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {dashboardTab === 'transactions' && (
                    <Transactions transactions={transactions} />
                  )}

                  {dashboardTab === 'withdraw' && (
                    <Withdraw 
                      profile={userProfile}
                      onWithdrawRequested={(updatedProf) => {
                        setUserProfile(updatedProf);
                        loadDashboardAssets();
                      }}
                      toast={triggerToast}
                    />
                  )}

                  {dashboardTab === 'notifications' && (
                    <Notifications 
                      notifications={notifications}
                      onMarkAllRead={handleMarkAllNotificationsRead}
                    />
                  )}

                  {dashboardTab === 'activity-logs' && (
                    <ActivityLogs logs={transactions.map(t => ({
                      id: t.id,
                      user_id: t.user_id,
                      action: t.type === 'mining' ? 'Mining Payout' : t.type === 'deposit' ? 'Deposit Completed' : 'Withdrawal Request',
                      details: t.description,
                      created_at: t.created_at
                    }))} />
                  )}

                  {dashboardTab === 'referrals' && (
                    <Referrals toast={triggerToast} />
                  )}

                  {dashboardTab === 'settings' && (
                    <Settings 
                      profile={userProfile}
                      onProfileUpdated={setUserProfile}
                      toast={triggerToast}
                      initialSegment={initialSettingsSegment}
                    />
                  )}

                  {dashboardTab === 'support' && (
                    <Support />
                  )}

                  {dashboardTab === 'admin' && userProfile.is_admin && (
                    <AdminPanel toast={triggerToast} />
                  )}
                </>
              )}
            </div>
          </main>

          {/* Mobile Sidebar overlay drawer selection portal */}
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-50 flex md:hidden">
              {/* Back backdrop shade */}
              <div onClick={() => setMobileSidebarOpen(false)} className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs"></div>

              {/* Sidebar drawer box */}
              <div className="relative flex flex-col w-64 max-w-xs bg-white h-full p-6 space-y-6 shadow-2xl animate-slide-in">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex justify-center items-center">
                      <span className="text-white text-sm font-extrabold">₿</span>
                    </div>
                    <span className="font-extrabold text-gray-900 text-base">CryptoBTC Miner</span>
                  </div>
                  <button onClick={() => setMobileSidebarOpen(false)} className="p-1 border border-gray-150 rounded-md">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto">
                  {userProfile?.is_admin && (
                    <button
                      onClick={() => { setMobileSidebarOpen(false); setDashboardTab('admin'); }}
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 bg-orange-500 text-white`}
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin Operations</span>
                    </button>
                  )}

                  {[
                    { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
                    { id: 'plans', label: 'Miner Plans', icon: <Award className="h-4 w-4" /> },
                    { id: 'transactions', label: 'Transactions', icon: <Clock className="h-4 w-4" /> },
                    { id: 'deposit', label: 'Deposit Funds', icon: <Download className="h-4 w-4" /> },
                    { id: 'withdraw', label: 'Withdrawal', icon: <Upload className="h-4 w-4" /> },
                    { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
                    { id: 'activity-logs', label: 'Activity Logs', icon: <Sliders className="h-4 w-4" /> },
                    { id: 'referrals', label: 'Referrals Link', icon: <Users className="h-4 w-4" /> },
                    { id: 'settings', label: 'Account Settings', icon: <SettingsIcon className="h-4 w-4" /> },
                    { id: 'support', label: 'Direct Support', icon: <LifeBuoy className="h-4 w-4" /> }
                  ].map((item) => {
                    if (item.id === 'deposit') {
                      return (
                        <button
                          key={item.id}
                          onClick={() => { setMobileSidebarOpen(false); setIsDepositModalOpen(true); }}
                          className="w-full px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-xl flex items-center space-x-2"
                        >
                          <Download className="h-4 w-4" />
                          <span>Deposit Funds (Modal)</span>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        onClick={() => { setMobileSidebarOpen(false); setDashboardTab(item.id); }}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 ${
                          dashboardTab === item.id
                            ? 'bg-orange-50 text-orange-500'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                {userProfile && (
                  <div className="border-t border-gray-100 pt-4 space-y-3">
                    <span className="text-xs font-bold text-gray-900 block truncate">{userProfile.full_name}</span>
                    <button onClick={handleSignOut} className="w-full bg-rose-50 border border-rose-100 text-rose-500 font-bold py-2 rounded-lg text-xs">
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== GLOBAL PAYMENT OVERLAY DEPOSIT MODAL ==================== */}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => {
          setIsDepositModalOpen(false);
          setSelectedPlanForDeposit(null);
        }}
        plans={plans}
        onDepositConfirmed={handleDepositConfirmed}
        toast={triggerToast}
        selectedPlanForModal={selectedPlanForDeposit}
      />



    </div>
  );
}
