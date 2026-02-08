import React from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';

const HelpPage: React.FC = () => {
  const [activeStep, setActiveStep] = React.useState(0);

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  const steps = [
    {
      label: 'Create a New Draft',
      description: 'Click on "New Draft" from the sidebar or dashboard to start creating a new policy document.',
    },
    {
      label: 'Enter Draft Information',
      description: 'Provide a title, description, and client information (name, country, city) for your policy draft.',
    },
    {
      label: 'Review Table of Contents',
      description: 'The system will suggest a table of contents based on similar policies. You can edit, add, or remove sections as needed.',
    },
    {
      label: 'Generate Content',
      description: 'Select each section and use AI assistance to generate relevant content. You can edit and refine the generated text.',
    },
    {
      label: 'Export Document',
      description: 'Once complete, export your policy document to Word format for final review and distribution.',
    },
  ];

  const faqs = [
    {
      question: 'What is ADA Policy Drafting?',
      answer: 'ADA is an AI-powered policy drafting application that helps you create comprehensive policy documents quickly and efficiently. It uses artificial intelligence to suggest content based on your requirements and similar existing policies.',
    },
    {
      question: 'How do I get started?',
      answer: 'After logging in, click on "New Draft" from the sidebar. Enter your draft information including title, description, and client details. The system will then guide you through the process of creating your policy document.',
    },
    {
      question: 'Can I edit the suggested content?',
      answer: 'Yes! All AI-generated content is fully editable. You can modify, add to, or completely rewrite any section to meet your specific needs.',
    },
    {
      question: 'How does the AI generate content?',
      answer: 'The AI analyzes your requirements and references similar policies in our database to generate relevant, contextual content for each section of your policy document.',
    },
    {
      question: 'Can I save my progress?',
      answer: 'Yes, your drafts are automatically saved as you work. You can return to any draft at any time from the "Drafts" page.',
    },
    {
      question: 'What export formats are available?',
      answer: 'Currently, you can export your completed policy documents to Microsoft Word (.docx) format. Additional formats may be added in future updates.',
    },
    {
      question: 'Is my data secure?',
      answer: 'Yes, all data is encrypted and stored securely. We use industry-standard security practices to protect your information.',
    },
    {
      question: 'Can multiple users collaborate on a draft?',
      answer: 'Ofcourse, all drafts can be edited by GT.',
    },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Help & Documentation
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="body1" fontWeight={600} gutterBottom>
          Getting Started
        </Typography>
        <Typography variant="caption" color="text.secondary" paragraph>
          Follow these steps to create your first policy document:
        </Typography>

        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>
                <Typography variant="body2">{step.label}</Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body2">{step.description}</Typography>
                <Box sx={{ mb: 1, mt: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleNext}
                    sx={{ mt: 0.5, mr: 1 }}
                    disabled={index === steps.length - 1}
                  >
                    {index === steps.length - 1 ? 'Finish' : 'Continue'}
                  </Button>
                  <Button
                    size="small"
                    disabled={index === 0}
                    onClick={handleBack}
                    sx={{ mt: 0.5, mr: 1 }}
                  >
                    Back
                  </Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
        {activeStep === steps.length - 1 && (
          <Paper square elevation={0} sx={{ p: 2 }}>
            <Typography variant="body2">All steps completed - you&apos;re ready to create policies!</Typography>
            <Button size="small" onClick={handleReset} sx={{ mt: 0.5, mr: 1 }}>
              Reset
            </Button>
          </Paper>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="body1" fontWeight={600} gutterBottom>
          Frequently Asked Questions
        </Typography>

          {faqs.map((faq, index) => (
            <Accordion key={index}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.75 } }}>
                <Typography variant="body2" fontWeight={500}>{faq.question}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ py: 1 }}>
                <Typography variant="body2">{faq.answer}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Paper>

    </Box>
  );
};

export default HelpPage;
