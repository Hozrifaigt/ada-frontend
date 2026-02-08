import React from 'react';
import { Box, Paper, Typography, Grid, Avatar, Divider } from '@mui/material';
import { Email, Badge, Business } from '@mui/icons-material';

const ProfilePage: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Profile
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: 'primary.main',
                fontSize: '2rem',
                mx: 'auto',
                mb: 1.5,
              }}
            >
              {(user.name || 'U')[0].toUpperCase()}
            </Avatar>
            <Typography variant="body1" fontWeight={600} gutterBottom>
              {user.name || 'User Name'}
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              {user.email || 'user@example.com'}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body1" fontWeight={600} gutterBottom>
              User Information
            </Typography>
            <Divider sx={{ mb: 1.5 }} />

            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Badge color="action" sx={{ fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Full Name
                    </Typography>
                    <Typography variant="body2">
                      {user.name || 'Demo User'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Email color="action" sx={{ fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Email Address
                    </Typography>
                    <Typography variant="body2">
                      {user.email || 'user@example.com'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Business color="action" sx={{ fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Organization
                    </Typography>
                    <Typography variant="body2">
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
