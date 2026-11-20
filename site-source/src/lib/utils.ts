import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Hash-router navigation shared by the Director views. */
export function navigate(hash: string) {
  window.location.hash = hash;
}
