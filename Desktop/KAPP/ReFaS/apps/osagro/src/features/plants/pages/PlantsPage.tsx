import { useState } from 'react';
import { PlantDashboard } from '../components/PlantDashboard';
import { PlantDatabaseOverview } from '../components/PlantDatabaseOverview';
import { PlantIntakeForm } from '../components/PlantIntakeForm';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'database', label: 'Database' },
  { key: 'intake', label: 'Plant toevoegen' }
];

export function PlantsPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              border: activeTab === tab.key ? '2px solid #2d5016' : '1px solid #ccc',
              background: activeTab === tab.key ? 'linear-gradient(135deg, #2d5016 0%, #4a7c3c 100%)' : '#f8fafc',
              color: activeTab === tab.key ? '#fff' : '#222',
              fontWeight: activeTab === tab.key ? 'bold' : 'normal',
              cursor: 'pointer',
              boxShadow: activeTab === tab.key ? '0 4px 12px rgba(45,80,22,0.12)' : 'none'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <PlantDashboard
          onAddPlant={() => setActiveTab('intake')}
          onGoList={() => setActiveTab('database')}
        />
      )}
      {activeTab === 'database' && <PlantDatabaseOverview />}
      {activeTab === 'intake' && <PlantIntakeForm onSuccess={() => setActiveTab('dashboard')} onCancel={() => setActiveTab('dashboard')} />}
    </div>
  );
}
