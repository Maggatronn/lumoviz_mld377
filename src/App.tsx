import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import MainApp from './components/MainApp';
import { theme } from './theme';

function App() {
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
        <MainApp />
      </Box>
    </ThemeProvider>
  );
}

export default App;
