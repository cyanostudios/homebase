import { connect } from '@homebase/db';

export const connectDB = async () => {
  return connect();
};
