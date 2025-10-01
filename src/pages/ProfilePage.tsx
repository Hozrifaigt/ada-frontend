import React from 'react';
import { Box, Paper, Typography, Grid, Avatar, Divider } from '@mui/material';
import { Email, Badge, Business } from '@mui/icons-material';

const ProfilePage: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                bgcolor: 'primary.main',
                fontSize: '3rem',
                mx: 'auto',
                mb: 2,
              }}
            >
              {(user.name || 'U')[0].toUpperCase()}
            </Avatar>
            <Typography variant="h5" gutterBottom>
              {user.name || 'User Name'}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {user.email || 'user@example.com'}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              User Information
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Badge color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Full Name
                    </Typography>
                    <Typography variant="body1">
                      {user.name || 'Demo User'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Email color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Email Address
                    </Typography>
                    <Typography variant="body1">
                      {user.email || 'user@example.com'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Business color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Organization
                    </Typography>
                    <Typography variant="body1">
                      Grant Thornton
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;