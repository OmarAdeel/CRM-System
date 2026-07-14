import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { importExportAPI } from '../services/api';
import { ArrowUpTrayIcon, ArrowDownTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ImportExportPage = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [importEntityType, setImportEntityType] = useState('contacts');
  const [result, setResult] = useState(null);

  const handleImport = async (e) => {
    e.preventDefault();
    if (!fileInputRef.current?.files?.[0]) {
      toast.error('Please select a CSV file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileInputRef.current.files[0]);

    setImporting(true);
    setResult(null);
    try {
      const res = await importExportAPI.import(importEntityType, formData);
      setResult(res.data.data);
      toast.success(t('common.imported'));
      fileInputRef.current.value = '';
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (entityType) => {
    setExporting(entityType);
    try {
      const res = await importExportAPI.export(entityType);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${entityType}-export-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('common.exported'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setExporting(null);
    }
  };

  const entities = [
    { value: 'contacts', label: t('contacts.title'), icon: '👤', sample: 'first_name,last_name,email,phone,job_title,company_id' },
    { value: 'companies', label: t('companies.title'), icon: '🏢', sample: 'name,domain,industry,company_size,phone,website' },
    { value: 'deals', label: t('deals.title'), icon: '💰', sample: 'title,value,currency,pipeline_id,stage_id,contact_id,owner_id,expected_close_date' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('navigation.importExport')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import Section */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <ArrowUpTrayIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Import CSV</h2>
              <p className="text-sm text-gray-500">Upload legacy data into the CRM</p>
            </div>
          </div>

          <form onSubmit={handleImport} className="space-y-4">
            <div>
              <label className="form-label">Entity Type</label>
              <select
                value={importEntityType}
                onChange={e => setImportEntityType(e.target.value)}
                className="form-input"
              >
                {entities.map(e => <option key={e.value} value={e.value}>{e.icon} {e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">CSV File</label>
              <input ref={fileInputRef} type="file" accept=".csv" className="form-input p-2" />
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-1">Expected columns:</p>
              <p className="text-xs text-gray-600 font-mono">
                {entities.find(e => e.value === importEntityType)?.sample}
              </p>
            </div>
            <button type="submit" disabled={importing} className="btn-primary w-full">
              {importing ? t('common.processing') : `Import ${importEntityType}`}
            </button>
          </form>

          {result && (
            <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm font-medium text-emerald-800">Import Complete</p>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-emerald-700">✓ {result.imported} imported</span>
                {result.errors > 0 && <span className="text-red-700">✗ {result.errors} errors</span>}
                <span className="text-gray-600">Total: {result.total}</span>
              </div>
            </div>
          )}
        </div>

        {/* Export Section */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-emerald-50 rounded-lg">
              <ArrowDownTrayIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Export Data</h2>
              <p className="text-sm text-gray-500">Download CRM data as CSV files</p>
            </div>
          </div>

          <div className="space-y-3">
            {entities.map((e) => (
              <button
                key={e.value}
                onClick={() => handleExport(e.value)}
                disabled={exporting === e.value}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{e.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{e.label}</p>
                    <p className="text-xs text-gray-500">Download all {e.label.toLowerCase()} as CSV</p>
                  </div>
                </div>
                {exporting === e.value ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                ) : (
                  <ArrowDownTrayIcon className="w-4 h-4 text-gray-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CSV Template Helper */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-gray-100 rounded-lg">
            <DocumentTextIcon className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">CSV Format Guide</h2>
            <p className="text-sm text-gray-500">Column names must match exactly (case-insensitive)</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {entities.map((e) => (
            <div key={e.value} className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">{e.icon} {e.label}</p>
              <p className="text-xs font-mono text-gray-500 break-all">{e.sample}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ImportExportPage;