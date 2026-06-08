import { useContext } from 'react';
import { AuthContext, AuthContextType } from '../context/AuthContext';

/**
 * Accesses global user credentials, loading sequences, and auth callbacks.
 * Raises structural error alerts if invoked outside the boundary of AuthProvider.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be consumed within a corresponding AuthProvider hierarchy');
  }
  
  return context;
};

export default useAuth;
