// Expose the Product context via a conventional hook
import { useProductContext } from '../context/ProductContext';

export function useProducts() {
  return useProductContext();
}
