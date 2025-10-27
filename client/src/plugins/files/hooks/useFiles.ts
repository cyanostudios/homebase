import { useFilesContext } from '../context/FilesContext';
export function useFiles() {
  return useFilesContext();
}
