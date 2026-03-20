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
    slim?: boolean;
}

export default function Dropdown({ 
    value, 
    onChange, 
    options, 
    placeholder = "Select option", 
    disabled = false,
    className = "",
    slim = false
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
                    w-full ${slim ? 'px-2 py-1' : 'px-4 py-2.5'} bg-(--surface) border border-(--border) rounded-xl
                    text-left flex items-center justify-between
                    transition-all duration-200
                    ${disabled 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'cursor-pointer hover:bg-(--surface-hover) hover:border-(--border-strong)'
                    }
                    ${isOpen ? 'bg-(--surface-hover) border-(--border-strong)' : ''}
                `}
            >
                <div className="flex items-center gap-3">
                    {selectedOption?.icon && (
                        <span className="text-white/60">{selectedOption.icon}</span>
                    )}
                    <span className={`${slim ? 'text-[11px] font-bold' : 'text-sm'} ${selectedOption ? 'text-white' : 'text-white'}`}>
                        {selectedOption?.label || placeholder}
                    </span>
                </div>
                <svg 
                    className={`w-3.5 h-3.5 text-white/80 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-(--surface) border border-(--border-strong) rounded-xl shadow-[0_10px_40px_-5px_rgba(0,0,0,0.8)] overflow-hidden">
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
                                    w-full ${slim ? 'px-2 py-1.5' : 'px-4 py-2'} text-right flex items-center gap-3
                                    transition-all duration-150
                                    ${option.disabled 
                                        ? 'opacity-50 cursor-not-allowed' 
                                        : 'cursor-pointer hover:bg-(--surface)'
                                    }
                                    ${value === option.value ? 'bg-violet-500/10 text-violet-400' : 'text-white hover:text-gray-200'}
                                `}
                            >
                                {option.icon && (
                                    <span className="text-white/60">{option.icon}</span>
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
