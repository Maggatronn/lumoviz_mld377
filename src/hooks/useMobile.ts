import { useState, useEffect } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';

export const useMobile = () => {
  const theme = useTheme();
  const isMobileQuery = useMediaQuery(theme.breakpoints.down('md'));
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileQuery);
  }, [isMobileQuery]);

  return isMobile;
};
