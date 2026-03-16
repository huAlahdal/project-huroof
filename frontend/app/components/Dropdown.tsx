import { useState, useRef, useEffect } from "react";

interface DropdownOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
    disabled?: boolean;
}

interface DropdownProps {
    value: string;
    onChange: (value: string) => void;
    options: DropdownOption[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export default function Dropdown({ 
    value, 
    onChange, 
    options, 
    placeholder = "Select option", 
    disabled = false,
    className = ""
}: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(option => option.value === value);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl
                    text-left flex items-center justify-between
                    transition-all duration-200
                    ${disabled 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'cursor-pointer hover:bg-white/10 hover:border-white/20'
                    }
                    ${isOpen ? 'bg-white/10 border-white/20' : ''}
                `}
            >
                <div className="flex items-center gap-3">
                    {selectedOption?.icon && (
                        <span className="text-white/60">{selectedOption.icon}</span>
                    )}
                    <span className={`text-sm ${selectedOption ? 'text-white' : 'text-white/40'}`}>
                        {selectedOption?.label || placeholder}
                    </span>
                </div>
                <svg 
                    className={`w-4 h-4 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    <div className="py-2 max-h-60 overflow-y-auto">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                disabled={option.disabled}
                                className={`
                                    w-full px-4 py-2 text-right flex items-center gap-3
                                    transition-all duration-150
                                    ${option.disabled 
                                        ? 'opacity-50 cursor-not-allowed' 
                                        : 'cursor-pointer hover:bg-white/5'
                                    }
                                    ${value === option.value ? 'bg-violet-500/10 text-violet-400' : 'text-white/80 hover:text-white'}
                                `}
                            >
                                {option.icon && (
                                    <span className="text-white/40">{option.icon}</span>
                                )}
                                <span className="text-sm">{option.label}</span>
                                {value === option.value && (
                                    <svg className="w-4 h-4 text-violet-400 mr-auto" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
