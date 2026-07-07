import { HelpCircle, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto bg-white/80 backdrop-blur-sm border-t border-gray-200">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <p>© 2025 OES. All rights reserved.</p>
            <span className="hidden md:inline text-gray-400">|</span>
            <p className="text-gray-500">Version 2.1.0</p>
          </div>
          
          <div className="flex items-center gap-6">
            <a 
              href="#" 
              className="flex items-center gap-2 hover:text-teal-600 transition-colors"
            >
              <HelpCircle className="size-4" />
              Technical Support
            </a>
            <a 
              href="#" 
              className="flex items-center gap-2 hover:text-teal-600 transition-colors"
            >
              <Mail className="size-4" />
              Contact Admin
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}