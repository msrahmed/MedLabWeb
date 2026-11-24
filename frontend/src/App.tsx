
import { useEffect, useState } from 'react'

import Login, { type LoginResponse } from './components/Login'

import {
  Activity, Users, CalendarDays, FlaskConical,
  FileText, CreditCard, Package, Settings,
  LayoutDashboard, Search, Bell,
  RefreshCw, ArrowUpRight, Database, Menu,
  ChevronLeft, ChevronRight, LogOut
} from 'lucide-react'

import './App.css'

interface DashboardData {
  patients: number
  visits: number
  tests: number
  test_results: number
  payment_records: number
  total_received: number
  pending_amount: number
  active_reagents: number
  low_stock: number
}

interface Patient {
  ID: number
  Name: string
  Age: number | null
  Gender: number | null
  Contact: string | null
  RegistrationDate: string | null
  DOB: string | null
  AgeMonths: number | null
}

interface PatientResponse {
  patients: Patient[]
  total: number
  limit: number
  offset: number
}

interface ManagedUser {
  Id: number
  Username: string
  FullName: string | null
  Email: string | null
  Role: number
  Status: number
  CreatedAt: string | null
  LastLogin: string | null
}

interface UserResponse {
  users: ManagedUser[]
  count: number
}

const API = 'http://127.0.0.1:8000'
const PAGE_SIZE = 10

const ROLE_NAMES: Record<number, string> = {
  0: 'Administrator',
  1: 'Manager',
  2: 'Staff',
  3: 'Doctor',
  4: 'Receptionist',
  5: 'MLT',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('en-GB')
}

function App() {
  // Authentication state
  const [auth, setAuth] = useState<LoginResponse | null>(null)

  // Dashboard state
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activePage, setActivePage] = useState('Dashboard')

  // Patient state
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [patientsError, setPatientsError] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [patientOffset, setPatientOffset] = useState(0)
  const [patientTotal, setPatientTotal] = useState(0)

  // User management state
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [userSearch, setUserSearch] = useState('')

  // Load dashboard data
  async function loadDashboard() {
    if (!auth) return

    try {
      setLoading(true)
      setError('')

      const response = await fetch(`${API}/api/dashboard/summary`, {
        headers: {
          Authorization: `Bearer ${auth.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const result: DashboardData = await response.json()
      setData(result)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect')
    } finally {
      setLoading(false)
    }
  }

  // Load patient data
  async function loadPatients() {
    if (!auth) return

    try {
      setPatientsLoading(true)
      setPatientsError('')

      const params = new URLSearchParams({
        search: patientSearch,
        limit: String(PAGE_SIZE),
        offset: String(patientOffset),
      })

      const response = await fetch(`${API}/api/patients?${params}`, {
        headers: {
          Authorization: `Bearer ${auth.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const result: PatientResponse = await response.json()

      setPatients(result.patients)
      setPatientTotal(result.total)

    } catch (err) {
      setPatientsError(
        err instanceof Error ? err.message : 'Unable to load patients'
      )
    } finally {
      setPatientsLoading(false)
    }
  }


  async function loadUsers() {
    if (!auth || auth.user.role !== 0) return

    try {
      setUsersLoading(true)
      setUsersError('')

      const params = new URLSearchParams({
        search: userSearch,
        limit: '50',
      })

      const response = await fetch(
        `${API}/api/admin/users?${params}`,
        {
          headers: {
            Authorization: `Bearer ${auth.access_token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const result: UserResponse = await response.json()
      setUsers(result.users)

    } catch (err) {
      setUsersError(
        err instanceof Error ? err.message : 'Unable to load users'
      )
    } finally {
      setUsersLoading(false)
    }
  }

  // Load dashboard after successful login
  useEffect(() => {
    if (auth) {
      loadDashboard()
    }
  }, [auth])

  // Load patients when the Patients page is opened
  useEffect(() => {
    if (auth && activePage === 'Patients') {
      loadPatients()
    }
  }, [auth, activePage, patientSearch, patientOffset])


  useEffect(() => {
    if (auth?.user.role === 0 && activePage === 'User Management') {
      loadUsers()
    }
  }, [auth, activePage, userSearch])

  // Sidebar navigation
    // Sidebar navigation with role-based visibility
  const menu = [
    {
      title: 'Dashboard',
      icon: LayoutDashboard,
      allowedRoles: [0, 1, 2, 3, 4, 5],
    },
    {
      title: 'Patients',
      icon: Users,
      allowedRoles: [0, 1, 3, 4, 5],
    },
    {
      title: 'User Management',
      icon: Users,
      allowedRoles: [0],
    },
  ]

  const visibleMenu = menu.filter(item =>
    item.allowedRoles.includes(auth?.user.role ?? -1)
  )

    // Prevent access to pages not permitted for the current role
  useEffect(() => {
    const allowed = visibleMenu.some(
      item => item.title === activePage
    )

    if (!allowed) {
      setActivePage('Dashboard')
    }
  }, [auth, activePage])
  

  // Dashboard metrics
  const metrics = [
    { label: 'Total Patients', value: data?.patients, icon: Users, color: 'blue' },
    { label: 'Total Visits', value: data?.visits, icon: CalendarDays, color: 'purple' },
    { label: 'Test Catalogue', value: data?.tests, icon: FlaskConical, color: 'green' },
    { label: 'Test Results', value: data?.test_results, icon: FileText, color: 'orange' },
  ]

  // Patient pagination
  const totalPages = Math.ceil(patientTotal / PAGE_SIZE)
  const currentPage = Math.floor(patientOffset / PAGE_SIZE) + 1

  function changePage(page: number) {
    setPatientOffset((page - 1) * PAGE_SIZE)
  }

  function changeSearch(value: string) {
    setPatientSearch(value)
    setPatientOffset(0)
  }

  // Refresh current page
  function refreshCurrentPage() {
    if (activePage === 'Patients') {
      loadPatients()
    } else if (activePage === 'Dashboard') {
      loadDashboard()
    }
  }

  // Logout
  function handleLogout() {
    setAuth(null)
    setData(null)
    setPatients([])
    setPatientTotal(0)
    setPatientSearch('')
    setPatientOffset(0)
    setActivePage('Dashboard')
    setError('')
    setPatientsError('')
  }

  // Show login screen if not authenticated
  if (!auth) {
    return <Login onLogin={setAuth} />
  }

  // Authenticated application
  return (
    <div className="app-shell">

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon"><Activity size={24} /></div>
          <div>
            <h2>MedLab</h2>
            <span>ADMINISTRATION</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          {visibleMenu.map(item => {
            const Icon = item.icon

            return (
              <button
                key={item.title}
                className={`nav-item ${activePage === item.title ? 'active' : ''}`}
                onClick={() => setActivePage(item.title)}
              >
                <Icon size={19} />
                <span>{item.title}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom">

          <div className="nav-label">SYSTEM</div>

          <button
            className={`nav-item ${activePage === 'Settings' ? 'active' : ''}`}
            onClick={() => setActivePage('Settings')}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <div className="environment">
            <span className="status-dot" />
            <div>
              <strong>Development mode</strong>
              <small>Local SQL Server</small>
            </div>
          </div>

        </div>
      </aside>

      <main className="main-area">

        <header className="topbar">

          <div className="breadcrumb">
            <Menu className="mobile-menu" size={20} />
            <span>MedLab</span>
            <span className="slash">/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="top-actions">

            <button className="icon-button" aria-label="Notifications">
              <Bell size={19} />
            </button>

            <div className="profile">
              <div className="avatar">
                {(auth.user.full_name || auth.user.username)
                  .charAt(0).toUpperCase()}
              </div>

              <div className="profile-text">
                <strong>
                  {auth.user.full_name || auth.user.username}
                </strong>
                <small>
                  {ROLE_NAMES[auth.user.role] || 'User'}
                </small>
              </div>
            </div>

            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={handleLogout}
            >
              <LogOut size={19} />
            </button>

          </div>

        </header>

        <div className="content">

          <section className="page-heading">
            <div>
              <div className="eyebrow">
                {activePage === 'Dashboard' ? 'OVERVIEW' : 'MANAGEMENT'}
              </div>

              <h1>{activePage}</h1>

              <p>
                {activePage === 'Dashboard'
                  ? 'Monitor your laboratory operations and performance.'
                  : activePage === 'Patients'
                    ? 'Search and view registered patient records.'
                    : 'This section is under development.'}
              </p>
            </div>

            <button className="refresh-button" onClick={refreshCurrentPage}>
              <RefreshCw
                size={16}
                className={
                  (activePage === 'Patients' ? patientsLoading : loading)
                    ? 'spin'
                    : ''
                }
              />
              Refresh data
            </button>
          </section>

          {/* DASHBOARD PAGE */}

          {activePage === 'Dashboard' && (
            <>
              {error && (
                <div className="error-banner">
                  <Activity size={18} />
                  <span>Unable to load dashboard data: {error}</span>
                  <button onClick={loadDashboard}>Retry</button>
                </div>
              )}

              <section className="metrics-grid">
                {metrics.map(metric => {
                  const Icon = metric.icon

                  return (
                    <div className="metric-card" key={metric.label}>
                      <div className="metric-top">
                        <span>{metric.label}</span>
                        <div className={`metric-icon ${metric.color}`}>
                          <Icon size={20} />
                        </div>
                      </div>

                      <div className="metric-value">
                        {loading ? '—' : (metric.value ?? 0).toLocaleString()}
                      </div>

                      <div className="metric-foot">
                        <span className="neutral-indicator">Database total</span>
                        <ArrowUpRight size={15} />
                      </div>
                    </div>
                  )
                })}
              </section>

              <section className="finance-grid">
                <div className="finance-card received">
                  <div className="finance-heading">
                    <span>Total received</span>
                    <div className="finance-icon"><CreditCard size={19} /></div>
                  </div>
                  <h2>
                    {loading ? '—' : formatCurrency(data?.total_received ?? 0)}
                  </h2>
                  <p>Recorded payments from visits</p>
                </div>

                <div className="finance-card pending">
                  <div className="finance-heading">
                    <span>Pending payments</span>
                    <div className="finance-icon"><Activity size={19} /></div>
                  </div>
                  <h2>
                    {loading ? '—' : formatCurrency(data?.pending_amount ?? 0)}
                  </h2>
                  <p>Outstanding visit balances</p>
                </div>
              </section>

              <section className="lower-grid">
                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Laboratory operations</h3>
                      <p>Current database overview</p>
                    </div>
                    <Database size={20} />
                  </div>

                  <div className="operation-row">
                    <div className="operation-icon green"><FlaskConical size={18} /></div>
                    <div className="operation-info">
                      <strong>Active reagents</strong>
                      <small>Available inventory items</small>
                    </div>
                    <strong>{loading ? '—' : data?.active_reagents ?? 0}</strong>
                  </div>

                  <div className="operation-row">
                    <div className="operation-icon orange"><Package size={18} /></div>
                    <div className="operation-info">
                      <strong>Low stock alerts</strong>
                      <small>Items at or below minimum quantity</small>
                    </div>
                    <strong>{loading ? '—' : data?.low_stock ?? 0}</strong>
                  </div>

                  <div className="operation-row">
                    <div className="operation-icon blue"><CreditCard size={18} /></div>
                    <div className="operation-info">
                      <strong>Payment records</strong>
                      <small>Recorded payment transactions</small>
                    </div>
                    <strong>{loading ? '—' : data?.payment_records ?? 0}</strong>
                  </div>
                </div>

                <div className="panel database-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>System status</h3>
                      <p>Backend connectivity</p>
                    </div>
                    <Activity size={20} />
                  </div>

                  <div className="connection-status">
                    <span className="large-status-dot" />
                    <div>
                      <strong>{error ? 'Connection issue' : 'API operational'}</strong>
                      <small>
                        {error ? 'Check backend service' : 'FastAPI server responding'}
                      </small>
                    </div>
                  </div>

                  <div className="system-detail">
                    <span>Database</span>
                    <strong>Local LabDB</strong>
                  </div>

                  <div className="system-detail">
                    <span>Environment</span>
                    <strong>Development</strong>
                  </div>

                  <div className="system-detail">
                    <span>Access mode</span>
                    <strong>Read-only dashboard</strong>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* PATIENTS PAGE */}

          {activePage === 'Patients' && (
            <section className="patients-section">

              <div className="patients-toolbar">
                <div className="patients-search">
                  <Search size={19} />
                  <input
                    type="text"
                    placeholder="Search by patient name, contact or ID..."
                    value={patientSearch}
                    onChange={event => changeSearch(event.target.value)}
                  />
                </div>

                <span className="patients-total">
                  {patientTotal.toLocaleString()} patients
                </span>
              </div>

              {patientsError && (
                <div className="error-banner">
                  <Activity size={18} />
                  <span>Unable to load patients: {patientsError}</span>
                  <button onClick={loadPatients}>Retry</button>
                </div>
              )}

              <div className="patients-table-wrapper">

                <table className="patients-table">
                  <thead>
                    <tr>
                      <th>Patient ID</th>
                      <th>Patient name</th>
                      <th>Age</th>
                      <th>Gender code</th>
                      <th>Contact</th>
                      <th>Registered date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {patientsLoading ? (
                      <tr>
                        <td colSpan={6} className="table-message">
                          Loading patient records...
                        </td>
                      </tr>
                    ) : patients.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="table-message">
                          No patient records found.
                        </td>
                      </tr>
                    ) : (
                      patients.map(patient => (
                        <tr key={patient.ID}>
                          <td className="patient-id">#{patient.ID}</td>
                          <td className="patient-name">{patient.Name}</td>
                          <td>
                            {patient.Age ?? '—'}
                            {patient.AgeMonths
                              ? ` (${patient.AgeMonths} months)`
                              : ''}
                          </td>
                          <td>{patient.Gender ?? '—'}</td>
                          <td>{patient.Contact || '—'}</td>
                          <td>{formatDate(patient.RegistrationDate)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

              </div>

              <div className="patients-pagination">
                <span>
                  Showing {patientTotal === 0 ? 0 : patientOffset + 1}
                  {'–'}
                  {Math.min(patientOffset + PAGE_SIZE, patientTotal)}
                  {' '}of {patientTotal}
                </span>

                <div className="pagination-controls">
                  <button
                    disabled={currentPage <= 1 || patientsLoading}
                    onClick={() => changePage(currentPage - 1)}
                  >
                    <ChevronLeft size={17} />
                    Previous
                  </button>

                  <span>
                    Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
                  </span>

                  <button
                    disabled={currentPage >= totalPages || patientsLoading}
                    onClick={() => changePage(currentPage + 1)}
                  >
                    Next
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>

            </section>
          )}

          {/* OTHER SECTIONS */}

          
{/* USER MANAGEMENT PAGE */}
{activePage === 'User Management' && auth.user.role === 0 && (
  <section className="patients-section">
    <div className="patients-toolbar">
      <div className="patients-search">
        <Search size={19} />
        <input
          type="text"
          placeholder="Search users..."
          value={userSearch}
          onChange={event => setUserSearch(event.target.value)}
        />
      </div>

      <span className="patients-total">
        {users.length} users
      </span>
    </div>

    {usersError && (
      <div className="error-banner">
        <Activity size={18} />
        <span>{usersError}</span>
        <button onClick={loadUsers}>Retry</button>
      </div>
    )}

    <div className="patients-table-wrapper">
      <table className="patients-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Full name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last login</th>
          </tr>
        </thead>

        <tbody>
          {usersLoading ? (
            <tr>
              <td colSpan={7} className="table-message">
                Loading users...
              </td>
            </tr>
          ) : users.length === 0 ? (
            <tr>
              <td colSpan={7} className="table-message">
                No users found.
              </td>
            </tr>
          ) : (
            users.map(user => (
              <tr key={user.Id}>
                <td>#{user.Id}</td>
                <td className="patient-name">{user.Username}</td>
                <td>{user.FullName || '—'}</td>
                <td>{user.Email || '—'}</td>
                <td>{ROLE_NAMES[user.Role] || 'Unknown'}</td>
                <td>{user.Status === 0 ? 'Active' : 'Inactive'}</td>
                <td>{formatDate(user.LastLogin)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </section>
)}

          {/* OTHER SECTIONS */}
          {activePage !== 'Dashboard' &&
          activePage !== 'Patients' &&
          activePage !== 'User Management' && (
            <div className="panel coming-soon">
              <Database size={32} />
              <h3>{activePage}</h3>
              <p>This module will be implemented in a future development step.</p>
            </div>
          )}


          <footer>
            MedLab Administration <span>•</span> Development environment
          </footer>

        </div>
      </main>
    </div>
  )
}

export default App
