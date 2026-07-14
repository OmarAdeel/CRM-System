import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Page Not Found</h2>
        <p className="mt-2 text-gray-500">The page you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="btn-primary mt-6 inline-flex">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
