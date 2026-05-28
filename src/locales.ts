export interface TranslationSet {
  welcome: string;
  login: string;
  register: string;
  dashboard: string;
  contracts: string;
  deposits: string;
  transactions: string;
  withdraw: string;
  notifications: string;
  settings: string;
  support: string;
  admin: string;
  logout: string;
  btcBalance: string;
  activePlan: string;
  status: string;
  email: string;
  password: string;
  fullName: string;
  referralCode: string;
  forgotPassword: string;
  startMining: string;
  submit: string;
  securityAlertSubject: string;
  alert2faTitle: string;
  alert2faBody: string;
  enable2fa: string;
  remindLater: string;
  manualSwitcher: string;
}

export type LanguageCode = 'en' | 'fr' | 'ar' | 'es' | 'pt' | 'ha' | 'sw';

export const LANGUAGES: { code: LanguageCode; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
  { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' }
];

export const translations: Record<LanguageCode, TranslationSet> = {
  en: {
    welcome: "Welcome to Crypto BTC Miner",
    login: "Login",
    register: "Register",
    dashboard: "Dashboard",
    contracts: "Mining Contracts",
    deposits: "Deposits",
    transactions: "Transactions",
    withdraw: "Withdraw Funds",
    notifications: "Notifications",
    settings: "Account Settings",
    support: "Help & Support",
    admin: "Admin Control",
    logout: "Sign Out",
    btcBalance: "BTC Balance",
    activePlan: "Active Mining Plan",
    status: "Account Status",
    email: "Email Address",
    password: "Password",
    fullName: "Full Name",
    referralCode: "Referral Code (Optional)",
    forgotPassword: "Forgot Password?",
    startMining: "Start Mining Operations",
    submit: "Submit Request",
    securityAlertSubject: "New Security Alert",
    alert2faTitle: "Boost Account Security",
    alert2faBody: "Protect your portfolio with Two-Factor Authentication (2FA) now to enforce bank-grade security over your withdrawals.",
    enable2fa: "Enable 2FA Now",
    remindLater: "Remind me later",
    manualSwitcher: "Language"
  },
  fr: {
    welcome: "Bienvenue sur Crypto BTC Miner",
    login: "Connexion",
    register: "S'inscrire",
    dashboard: "Tableau de Bord",
    contracts: "Contrats de Minage",
    deposits: "Dépôts",
    transactions: "Transactions",
    withdraw: "Retirer des Fonds",
    notifications: "Notifications",
    settings: "Paramètres de Compte",
    support: "Aide & Assistance",
    admin: "Contrôle Admin",
    logout: "Se Déconnecter",
    btcBalance: "Solde BTC",
    activePlan: "Plan de Minage Actif",
    status: "Statut du Compte",
    email: "Adresse E-mail",
    password: "Mot de passe",
    fullName: "Nom Complet",
    referralCode: "Code de Parrainage (Optionnel)",
    forgotPassword: "Mot de passe oublié?",
    startMining: "Démarrer le Minage",
    submit: "Soumettre la demande",
    securityAlertSubject: "Nouvelle Alerte de Sécurité",
    alert2faTitle: "Renforcer la sécurité",
    alert2faBody: "Protégez votre portefeuille avec la Double Authentification (2FA) dès maintenant pour sécuriser vos retraits.",
    enable2fa: "Activer la 2FA",
    remindLater: "Plus tard",
    manualSwitcher: "Langue"
  },
  ar: {
    welcome: "مرحباً بك في كربتو بي تي سي ماينر",
    login: "تسجيل الدخول",
    register: "إنشاء حساب",
    dashboard: "لوحة التحكم",
    contracts: "عقود التعدين",
    deposits: "الإيداعات",
    transactions: "المعاملات",
    withdraw: "سحب الأموال",
    notifications: "الإشعارات",
    settings: "إعدادات الحساب",
    support: "الدعم والمساعدة",
    admin: "إدارة النظام",
    logout: "تسجيل الخروج",
    btcBalance: "رصيد البيتكوين",
    activePlan: "خطة التعدين النشطة",
    status: "حالة الحساب",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    fullName: "الاسم الكامل",
    referralCode: "رمز الإحالة (اختياري)",
    forgotPassword: "هل نسيت كلمة المرور؟",
    startMining: "بدء عمليات التعدين",
    submit: "تقديم الطلب",
    securityAlertSubject: "تنبيه أمني جديد",
    alert2faTitle: "تحسين أمان الحساب",
    alert2faBody: "قم بحماية محفظتك الآن باستخدام المصادقة الثنائية (2FA) لفرض حماية بمستوى أمان البنوك على سحوباتك.",
    enable2fa: "تفعيل المصادقة الثنائية",
    remindLater: "ذكرني لاحقاً",
    manualSwitcher: "اللغة"
  },
  es: {
    welcome: "Bienvenido a Crypto BTC Miner",
    login: "Iniciar Sesión",
    register: "Registrarse",
    dashboard: "Panel de Control",
    contracts: "Contratos de Minería",
    deposits: "Depósitos",
    transactions: "Transacciones",
    withdraw: "Retirar Fondos",
    notifications: "Notificaciones",
    settings: "Configuración",
    support: "Soporte Técnico",
    admin: "Administración",
    logout: "Cerrar Sesión",
    btcBalance: "Saldo BTC",
    activePlan: "Plan de Minería Activo",
    status: "Estado de la Cuenta",
    email: "Correo Electrónico",
    password: "Contraseña",
    fullName: "Nombre Completo",
    referralCode: "Código de Referido (Opcional)",
    forgotPassword: "¿Olvidó su contraseña?",
    startMining: "Iniciar Minería",
    submit: "Enviar Solicitud",
    securityAlertSubject: "Nueva Alerta de Seguridad",
    alert2faTitle: "Mejorar Seguridad",
    alert2faBody: "Proteja su portafolio con Autenticación de Dos Factores (2FA) hoy mismo para asegurar sus retiros con seguridad bancaria.",
    enable2fa: "Activar 2FA",
    remindLater: "Recordar más tarde",
    manualSwitcher: "Idioma"
  },
  pt: {
    welcome: "Bem-vindo ao Crypto BTC Miner",
    login: "Entrar",
    register: "Registrar-se",
    dashboard: "Painel de Controle",
    contracts: "Contratos de Mineração",
    deposits: "Depósitos",
    transactions: "Transações",
    withdraw: "Retirar Fundos",
    notifications: "Notificações",
    settings: "Configurações",
    support: "Ajuda e Suporte",
    admin: "Painel Admin",
    logout: "Sair",
    btcBalance: "Saldo BTC",
    activePlan: "Plano Ativo",
    status: "Status da Conta",
    email: "Endereço de E-mail",
    password: "Senha",
    fullName: "Nome Completo",
    referralCode: "Código de Indicação (Opcional)",
    forgotPassword: "Esqueceu a senha?",
    startMining: "Iniciar Mineração",
    submit: "Enviar Solicitação",
    securityAlertSubject: "Alerta de Segurança",
    alert2faTitle: "Melhorar Segurança",
    alert2faBody: "Proteja seu portfólio com Autenticação de Dois Fatores (2FA) agora para garantir segurança de nível bancário nos seus saques.",
    enable2fa: "Ativar 2FA",
    remindLater: "Lembrar mais tarde",
    manualSwitcher: "Idioma"
  },
  ha: {
    welcome: "Barka da Zuwa Crypto BTC Miner",
    login: "Shiga Ciki",
    register: "Rijista",
    dashboard: "Shafin Kulawa",
    contracts: "Kwangilar Ma'adinai",
    deposits: "Ajiyar Kudi",
    transactions: "Ma'amaloli",
    withdraw: "Cire Kudi",
    notifications: "Sanarwa",
    settings: "Saitunan Akaundi",
    support: "Taimako da Agaji",
    admin: "Sashin Admin",
    logout: "Fita",
    btcBalance: "Ma'aunin BTC",
    activePlan: "Tsarin Ma'adinai na Yanzu",
    status: "Yankin Akaundi",
    email: "Adireshin Imel",
    password: "Kalmar Sirri",
    fullName: "Cikakken Suna",
    referralCode: "Lambar Gayyata (Na Zabi)",
    forgotPassword: "Ka manta kalmar sirri?",
    startMining: "Fara Ma'adinai",
    submit: "Aika da Bukata",
    securityAlertSubject: "Sanarwar Tsaro",
    alert2faTitle: "Inganta Tsaron Akaundi",
    alert2faBody: "Kare akaundinka ta hanyar amfani da Tabbatarwa matakai biyu (2FA) yanzu don tabbatar da tsaro matakin banki akan cire kudi.",
    enable2fa: "Kunna 2FA Yanzu",
    remindLater: "Tunatar da ni an jima",
    manualSwitcher: "Harshe"
  },
  sw: {
    welcome: "Karibu kwenye Crypto BTC Miner",
    login: "Ingia",
    register: "Sajili Akaundi",
    dashboard: "Meneja wako",
    contracts: "Mikataba ya Uchimbaji",
    deposits: "Kuweka Akiba",
    transactions: "Miamala",
    withdraw: "Kutoa Pesa",
    notifications: "Arifa",
    settings: "Mipangilio",
    support: "Msaada na Huduma",
    admin: "Ukurasa wa Admin",
    logout: "Ondoka",
    btcBalance: "Salio la BTC",
    activePlan: "Mpango Amilifu",
    status: "Hali ya Akaundi",
    email: "Anwani ya Barua Pepe",
    password: "Nywila / Nenosiri",
    fullName: "Majina Kamili",
    referralCode: "Nambari ya Rufaa (Hiari)",
    forgotPassword: "Umesahau nenosiri?",
    startMining: "Anza Uchimbaji",
    submit: "Wasilisha Ombi",
    securityAlertSubject: "Arifa ya Usalama",
    alert2faTitle: "Boresha Usalama",
    alert2faBody: "Kinga akaunti yako kwa kuweka Uthibitishaji wa Hatua Mbili (2FA) sasa ili kulinda pesa zako dhidi ya wizi unapoondoa.",
    enable2fa: "Washa 2FA Sasa",
    remindLater: "Nikumbushe baadaye",
    manualSwitcher: "Lugha"
  }
};
