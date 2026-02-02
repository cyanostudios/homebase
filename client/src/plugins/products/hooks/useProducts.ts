import { useProductContext } from '../context/ProductContext';

export function useProducts() {
  return useProductContext();
}
