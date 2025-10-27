// TEMPLATE types — copy and rename to your domain (e.g., products.ts)

export interface ValidationError {
  field: string;
  message: string;
}

export interface YourItem {
  id: string;
  // TODO: add your canonical fields here
  title?: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}
