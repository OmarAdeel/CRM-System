import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const PlaceholderPage = ({ title, description, createLabel, createPath }) => {
  const { t } = useTranslation();

  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title || t('app.title')}</h2>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        {description || 'This section is ready for implementation.'}
      </p>
      {createLabel && (
        <Link to={createPath || '#'} className="btn-primary">
          + {createLabel}
        </Link>
      )}
    </div>
  );
};

export default PlaceholderPage;
