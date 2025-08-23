import { useChannelsContext } from '../context/ChannelsContext';

export function useChannels() {
  return useChannelsContext();
}
