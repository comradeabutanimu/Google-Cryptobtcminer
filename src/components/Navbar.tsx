/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Menu, X, Coins, Globe } from 'lucide-react';
import { LANGUAGES, LanguageCode } from '../locales.ts';

interface NavbarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
  isLoggedIn: boolean;
  onLogout: () => void;
  currentLang: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
}

export default function Navbar({ 
  onNavigate, 
  currentPage, 
  isLoggedIn, 
  onLogout,
  currentLang,
  onLanguageChange
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    onNavigate('home');
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[#E7E7E4] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-[72px]">
          {/* Logo */}
          <div className="flex items-center cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[#F97316] rounded-full flex items-center justify-center shadow-sm">
                <span className="text-white text-base font-extrabold">₿</span>
              </div>
              <span className="text-xl font-extrabold tracking-tight">
                <span className="text-[#1A1A1A]">CryptoBTC</span>
                <span className="text-[#F97316] ml-0.5">Miner</span>
              </span>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center space-x-[32px]">
            <button 
              onClick={() => onNavigate('home')} 
              className={`text-sm font-medium transition-colors cursor-pointer ${currentPage === 'home' ? 'text-[#F97316]' : 'text-[#4B5563] hover:text-[#F97316]'}`}
            >
              Home
            </button>
            <button 
              onClick={() => scrollToSection('plans')} 
              className="text-sm font-medium text-[#4B5563] hover:text-[#F97316] transition-colors cursor-pointer"
            >
              Plans
            </button>
            <button 
              onClick={() => scrollToSection('faq')} 
              className="text-sm font-medium text-[#4B5563] hover:text-[#F97316] transition-colors cursor-pointer"
            >
              FAQ
            </button>
          </div>

          {/* Right Core Action Pill Buttons */}
          <div className="hidden md:flex items-center space-x-[20px]">
            {/* Manual Language Switcher */}
            <div className="relative flex items-center space-x-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
              <Globe className="h-3.5 w-3.5 text-gray-500" />
              <select
                value={currentLang}
                onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
                className="text-xs font-semibold text-gray-700 bg-transparent border-none focus:outline-hidden cursor-pointer pre-selected"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {isLoggedIn ? (
              <>
                <button 
                  onClick={() => onNavigate('dashboard')} 
                  className="px-4 py-2 text-sm font-medium text-[#4B5563] hover:text-[#F97316] transition-colors"
                >
                  Dashboard
                </button>
                <button 
                  onClick={onLogout} 
                  className="px-[24px] py-[10px] text-sm font-bold text-white bg-[#F97316] hover:bg-[#EA580C] rounded-full cursor-pointer shadow-xs hover:shadow-md transition-all duration-200"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => onNavigate('login')} 
                  className="text-sm font-bold text-[#4B5563] hover:text-[#F97316] transition-colors cursor-pointer"
                >
                  Sign in
                </button>
                <button 
                  onClick={() => onNavigate('register')} 
                  className="px-[24px] py-[10px] text-sm font-bold text-white bg-[#F97316] hover:bg-[#EA580C] rounded-full shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  Get started
                </button>
              </>
            )}
          </div>

          {/* Mobile responsive toggle */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-orange-500 hover:bg-gray-100 focus:outline-hidden"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer list */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 px-4 pt-2 pb-4 space-y-1">
          <button
            onClick={() => { setMobileMenuOpen(false); onNavigate('home'); }}
            className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-500"
          >
            Home
          </button>
          <button
            onClick={() => scrollToSection('plans')}
            className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-500"
          >
            Plans
          </button>
          <button
            onClick={() => scrollToSection('faq')}
            className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-500"
          >
            FAQ
          </button>

          {/* Lang Selector inside mobile drawer */}
          <div className="px-3 py-2 flex items-center space-x-2 border-t border-gray-100 mt-2">
            <Globe className="h-4 w-4 text-gray-500" />
            <select
              value={currentLang}
              onChange={(e) => {
                onLanguageChange(e.target.value as LanguageCode);
                setMobileMenuOpen(false);
              }}
              className="text-sm border border-gray-200 rounded-md p-1 focus:outline-hidden text-gray-700"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-gray-100 my-2 pt-2">
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => { setMobileMenuOpen(false); onNavigate('dashboard'); }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-500"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                  className="block w-full text-left px-3 py-2 mt-1 rounded-md text-base font-medium text-white bg-orange-500 hover:bg-orange-600 text-center"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setMobileMenuOpen(false); onNavigate('login'); }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-500"
                >
                  Sign in
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); onNavigate('register'); }}
                  className="block w-full text-center px-3 py-2 mt-2 rounded-md text-base font-medium text-white bg-orange-500 hover:bg-orange-600"
                >
                  Get started
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
