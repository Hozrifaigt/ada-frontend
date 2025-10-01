import React from 'react';
import { Box, Typography, Button, Paper, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Description, Add, Policy } from '@mui/icons-material';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box>
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Welcome to ADA Policy Drafting
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Create comprehensive policy documents quickly and efficiently
        </Typography>
      </Box>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 4, textAlign: 'center', height: '100%' }}>
            <Add sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Create New Draft
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Start a new policy document from scratch with AI assistance
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/drafts/new')}
            >
              Start New Draft
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 4, textAlign: 'center', height: '100%' }}>
            <Description sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Drafts
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              View and manage your existing policy drafts
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => navigate('/drafts')}
            >
              View Drafts
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 4, textAlign: 'center', height: '100%' }}>
            <Policy sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Templates
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Browse policy templates to get started quickly
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              disabled
            >
              Coming Soon
            </Button>
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ mt: 6, p: 4, bgcolor: 'background.paper', borderRadius: 2 }}>
        <Typography variant="h5" gutterBottom>
          How It Works
        </Typography>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12} md={3}>
            <Typography variant="h6" color="primary.main">1. Initialize</Typography>
            <Typography variant="body2">
              Create a new draft with title, description, and client information
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="h6" color="primary.main">2. Structure</Typography>
            <Typography variant="body2">
              Review and customize the suggested table of contents
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="h6" color="primary.main">3. Generate</Typography>
            <Typography variant="body2">
              Generate content for each section using AI assistance
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="h6" color="primary.main">4. Export</Typography>
            <Typography variant="body2">
              Export your completed policy document to Word format
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default HomePage;