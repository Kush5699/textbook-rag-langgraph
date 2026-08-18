import React, { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AmbientGradient from '../components/landing/AmbientGradient';
import WordReveal from '../components/landing/WordReveal';

const Hero3DScene = lazy(() => import('../components/landing/Hero3DScene'));

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row overflow-hidden relative">
      <AmbientGradient />
      
      <div className="flex-1 flex flex-col justify-center p-8 md:p-16 z-10">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-display font-bold text-on-surface mb-6 max-w-xl leading-tight"
        >
          Ask your textbooks anything.
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-on-surface-variant mb-8 max-w-lg leading-relaxed"
        >
          The official conversational AI assistant for the Gujarat State School Board. 
          Search, study, and verify answers directly from Std 9 to 12 textbooks.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-4"
        >
          <button 
            onClick={() => navigate('/login')} 
            className="bg-primary text-on-primary px-8 py-3 rounded-full font-medium hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-md hover:shadow-lg"
          >
            Enter Study
          </button>
          <button className="bg-surface-container-high text-on-surface px-8 py-3 rounded-full font-medium hover:bg-surface-container-highest transition-colors">
            Watch Demo
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex gap-6 mt-12 text-sm text-on-surface-variant"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-subject-maths"></span>
            Mathematics
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-subject-science"></span>
            Science
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-subject-social"></span>
            Social Science
          </span>
        </motion.div>
      </div>
      
      <div className="flex-1 hidden md:flex items-center justify-center relative z-10">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        }>
          <Hero3DScene />
        </Suspense>
      </div>
    </div>
  );
}
