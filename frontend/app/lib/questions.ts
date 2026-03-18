import { API_BASE } from './api';

export interface Question {
  id: string;
  letter: string;
  question: string;
  answer: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

export const CATEGORIES = ["جغرافيا", "تاريخ", "علوم", "دين", "رياضة", "فن وثقافة", "أدب", "عام"];

export const GAME_LETTERS = [
  "أ", "ب", "ت", "ث", "ج", "ح", "خ", "د",
  "ر", "ز", "س", "ش", "ص", "ط", "ع", "غ",
  "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"
];

/**
 * Fetch questions from the backend database with optional filters.
 */
export async function fetchQuestionsFromBackend(filters?: {
  letter?: string;
  category?: string;
  difficulty?: string;
  search?: string;
}): Promise<Question[]> {
  const params = new URLSearchParams();
  if (filters?.letter) params.append("letter", filters.letter);
  if (filters?.category) params.append("category", filters.category);
  if (filters?.difficulty) params.append("difficulty", filters.difficulty);
  if (filters?.search) params.append("search", filters.search);
  
  const url = `${API_BASE}/api/questions${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch questions");
  return response.json();
}

/**
 * Fetch a random question for a given letter from the backend.
 */
export async function fetchRandomQuestion(letter: string): Promise<Question | null> {
  try {
    const response = await fetch(`${API_BASE}/api/questions/random?letter=${encodeURIComponent(letter)}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}
