import React, { useEffect, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import MainApp from './components/MainApp';
import LoginPage from './components/LoginPage';
import { theme } from './theme';
import { checkAuth, clearAuth, AuthUser } from './services/auth';

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAuth().then(user => {
      setAuthUser(user);
      setAuthChecked(true);
    });
  }, []);

  const handleLogin = (user: AuthUser) => {
    setAuthUser(user);
  };

  const handleLogout = () => {
    clearAuth();
    setAuthUser(null);
  };

  if (!authChecked) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <CircularProgress sx={{ color: 'white' }} size={48} />
        </Box>
      </ThemeProvider>
    );
  }

  if (!authUser) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LoginPage onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box 
        sx={{ 
          width: '100vw', 
          height: '100vh', 
          overflow: 'hidden',
          backgroundColor: 'background.default'
        }}
      >
        <MainApp authUser={authUser} onLogout={handleLogout} />
      </Box>
    </ThemeProvider>
  );
}

export default App;
