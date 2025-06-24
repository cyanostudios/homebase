import { connect } from '@homebase/db';

export async function connectDB() {
  const result = connect();
  console.log('DB connection:', result);
  return result;
}
