import React, { ReactNode, useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Divider,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Description,
  Add,
  Help,
  Person,
  Logout,
  ChevronLeft,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import Footer from './Footer';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

const drawerWidth = 240;

const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { instance, accounts } = useMsal();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const account = accounts[0];
  const user = account ? {
    name: account.name || account.username,
    email: account.username
  } : JSON.parse(localStorage.getItem('user') || '{}');

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleProfileMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    // Set a flag to prevent auto-login after logout
    localStorage.setItem('justLoggedOut', 'true');

    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');

    try {
      // Clear MSAL cache
      const accounts = instance.getAllAccounts();

      if (accounts.length > 0) {
        // For local development, we'll use a simpler approach
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (isLocalhost) {
          // For localhost, do a local-only logout
          console.log('Local logout - clearing session without Microsoft redirect');

          // Clear MSAL active account
          instance.setActiveAccount(null);

          // Clear all MSAL-related items from localStorage
          const msalKeys = Object.keys(localStorage).filter(key =>
            key.includes('msal') || key.includes('login.windows') || key.includes('login.microsoft')
          );
          msalKeys.forEach(key => localStorage.removeItem(key));

          // Clear session storage as well
          const sessionKeys = Object.keys(sessionStorage).filter(key =>
            key.includes('msal') || key.includes('login.windows') || key.includes('login.microsoft')
          );
          sessionKeys.forEach(key => sessionStorage.removeItem(key));

          // Redirect to login page
          window.location.href = '/login?logout=true';
        } else {
          // For production, use the full logout redirect
          const redirectUri = process.env.REACT_APP_AZURE_REDIRECT_URI || window.location.origin;
          const postLogoutRedirectUri = `${redirectUri}/login?logout=true`;

          await instance.logoutRedirect({
            postLogoutRedirectUri: postLogoutRedirectUri,
            account: accounts[0]
          });
        }
      } else {
        // If no accounts, just redirect to login
        window.location.href = '/login?logout=true';
      }
    } catch (error) {
      console.error('Logout error:', error);

      // Fallback: Clear everything locally and force redirect
      try {
        instance.setActiveAccount(null);

        // Clear the MSAL cache in localStorage
        const msalKeys = Object.keys(localStorage).filter(key =>
          key.includes('msal') || key.includes('login.windows') || key.includes('login.microsoft')
        );
        msalKeys.forEach(key => localStorage.removeItem(key));

        // Clear session storage as well
        const sessionKeys = Object.keys(sessionStorage).filter(key =>
          key.includes('msal') || key.includes('login.windows') || key.includes('login.microsoft')
        );
        sessionKeys.forEach(key => sessionStorage.removeItem(key));
      } catch (e) {
        console.error('Failed to clear MSAL data:', e);
      }

      // Force redirect to login page
      window.location.href = '/login?logout=true';
    }
  };

  const menuItems = [
    { text: 'Drafts', icon: <Description />, path: '/drafts' },
    { text: 'New Draft', icon: <Add />, path: '/drafts/new' },
    { text: 'Profile', icon: <Person />, path: '/profile' },
    { text: 'Help', icon: <Help />, path: '/help' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: isMobile ? '100%' : (drawerOpen ? `calc(100% - ${drawerWidth}px)` : '100%'),
          ml: isMobile ? 0 : (drawerOpen ? `${drawerWidth}px` : 0),
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          transition: (theme) =>
            theme.transitions.create(['margin', 'width'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{ mr: 2 }}
          >
            {drawerOpen ? <ChevronLeft /> : <MenuIcon />}
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            ADA Policy Drafting
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, display: { xs: 'none', sm: 'block' } }}>
              {user.name || 'User'}
            </Typography>
            <IconButton onClick={handleProfileMenu} sx={{ p: 0 }}>
              <Avatar sx={{
                width: 36,
                height: 36,
                bgcolor: 'rgba(255, 255, 255, 0.95)',
                color: '#667eea',
                fontWeight: 600,
                border: '2px solid rgba(255, 255, 255, 0.3)'
              }}>
                {(user.name || 'U')[0].toUpperCase()}
              </Avatar>
            </IconButton>
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={() => { navigate('/profile'); handleMenuClose(); }}>
              <ListItemIcon>
                <Person fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: (theme) =>
              theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
          },
        }}
        variant={isMobile ? 'temporary' : 'persistent'}
        anchor="left"
        open={isMobile ? drawerOpen : drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Toolbar>
          <Typography variant="h5" sx={{ fontWeight: 'bold', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ADA
          </Typography>
        </Toolbar>
        <Divider />

        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <List sx={{ flex: 0, py: 1 }}>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    mb: 0.5,
                    '&:hover': {
                      backgroundColor: 'rgba(102, 126, 234, 0.08)',
                    },
                    '&.Mui-selected': {
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      '& .MuiListItemIcon-root': {
                        color: 'white',
                      },
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4196 100%)',
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: location.pathname === item.path ? 'white' : '#667eea',
                      minWidth: 40,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} sx={{ '& .MuiTypography-root': { fontWeight: location.pathname === item.path ? 600 : 400 } }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          <Box sx={{ flexGrow: 1 }} />

          <Divider />
          <Box sx={{ p: 1, pb: 2 }}>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                borderRadius: 2,
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                color: '#ef4444',
                '&:hover': {
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                },
              }}
            >
              <ListItemIcon sx={{ color: '#ef4444', minWidth: 40 }}>
                <Logout />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </Box>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          width: isMobile ? '100%' : (drawerOpen ? `calc(100% - ${drawerWidth}px)` : '100%'),
          ml: isMobile ? 0 : (drawerOpen ? 0 : `-${drawerWidth}px`),
          minHeight: '100vh',
          transition: (theme) =>
            theme.transitions.create(['margin', 'width'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
        }}
      >
        <Toolbar />
        <Box sx={{ flexGrow: 1, p: { xs: 1.5, sm: 2, md: 3 } }}>
          {children}
        </Box>
        <Footer />
      </Box>
    </Box>
  );
};

export default AuthenticatedLayout;