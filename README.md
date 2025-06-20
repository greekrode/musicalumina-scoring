# 🎹 Musica Lumina Scoring System

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

*A comprehensive real-time piano competition scoring and management system*

</div>

---

## 📖 Overview

This application provides a comprehensive platform for managing piano competitions, allowing administrators to set up events and scoring criteria while enabling jury members to score participants independently. The system features real-time synchronization, automated prize assignment, and comprehensive audit trails.

---

## ✨ Features

### 🎯 Admin Dashboard
- **🎪 Event Management**: Create and manage competition events with categories and subcategories
- **📊 Scoring Criteria**: Define custom scoring aspects with weights for each event
- **🏆 Prize Configuration**: Set up prize levels with score ranges and winner limits
- **⚡ Real-time Results**: View live scoring updates as juries submit scores
- **🎖️ Prize Assignment**: Automatic prize allocation based on scores and configurations
- **📋 Audit Trail**: Complete history of all scoring activities
- **📤 Data Export**: Export results to CSV for external use

### ⚖️ Jury Interface
- **🔒 Independent Scoring**: Score participants without seeing other jury scores (maintains confidentiality)
- **✏️ Simplified Scoring**: Single final score input with optional remarks
- **🎯 Category Selection**: Choose specific competition categories to score
- **📝 Score Management**: Edit scores until finalized by admin

### 🌟 Key Features
- **🔄 Real-time Sync**: Admin dashboard updates automatically when juries submit scores
- **🤐 Confidential Scoring**: Juries cannot see each other's scores to maintain independence
- **🏅 Flexible Prize System**: Support for complex prize structures with ties and score ranges
- **📱 Responsive Design**: Works on desktop and mobile devices
- **🔐 Secure Authentication**: Role-based access control via Clerk

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| ![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react) | 18.2.0 | Frontend Framework |
| ![TypeScript](https://img.shields.io/badge/TypeScript-5.0.2-3178C6?logo=typescript) | 5.0.2 | Type Safety |
| ![Vite](https://img.shields.io/badge/Vite-4.4.5-646CFF?logo=vite) | 4.4.5 | Build Tool |
| ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3.0-06B6D4?logo=tailwindcss) | 3.3.0 | Styling |
| ![Supabase](https://img.shields.io/badge/Supabase-2.38.0-3ECF8E?logo=supabase) | 2.38.0 | Database & Real-time |
| ![Clerk](https://img.shields.io/badge/Clerk-4.23.2-6C47FF?logo=clerk) | 4.23.2 | Authentication |

### 🏗️ Architecture
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom piano-themed color palette
- **Authentication**: Clerk (role-based access control)
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Real-time**: Supabase Realtime for live score updates
- **State Management**: React Context + useReducer
- **Build Tool**: Vite for fast development and builds

---

## 🚀 Key Technical Challenges

### 1. ⚡ Real-time Synchronization
**🎯 Challenge**: Sync scoring data between jury and admin interfaces without causing infinite loops.

**✅ Solution**: 
- Custom `useRealtimeScoring` hook with stable callback references using `useRef`
- Proper dependency management in useEffect to prevent constant re-subscriptions
- Admin-only real-time updates to maintain jury scoring independence

### 2. 🔐 Confidential Scoring
**🎯 Challenge**: Allow juries to score independently without seeing other jury scores.

**✅ Solution**:
- Separate data flows for jury vs admin interfaces
- Juries only see their own scores
- Real-time updates only enabled for admin dashboard

### 3. 🏆 Complex Prize Assignment
**🎯 Challenge**: Handle automatic prize assignment with ties, score ranges, and multiple winners.

**✅ Solution**:
- Flexible prize configuration system with min/max scores and winner limits
- Intelligent tie-handling that can override winner limits for fairness
- Cascading prize assignment where unassigned participants fall to lower prize levels

### 4. ⚡ Performance Optimization
**🎯 Challenge**: Efficiently load and display large amounts of scoring data.

**✅ Solution**:
- Batch database queries to minimize API calls
- Smart data mapping and caching
- Optimized re-renders with proper React patterns

### 5. 🎛️ State Management
**🎯 Challenge**: Manage complex application state across multiple components and real-time updates.

**✅ Solution**:
- React Context with useReducer for global state
- Custom hooks for data fetching and real-time subscriptions
- Proper separation of concerns between UI and business logic

---

## 🗄️ Database Schema

| Table | Purpose |
|-------|---------|
| `events` | 🎪 Competition events |
| `event_categories` / `event_subcategories` | 📂 Competition categories |
| `registrations` | 👥 Participant registrations |
| `event_scoring` | 🎯 Final scores from juries |
| `event_scoring_history` | 📝 Audit trail of all changes |
| `event_prize_configurations` | 🏆 Prize level definitions |

---

## 🚀 Getting Started

### 📋 Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Clerk account

### ⚙️ Installation

1. **📥 Clone the repository**
   ```bash
   git clone https://github.com/your-username/musicalumina-scoring.git
   cd musicalumina-scoring
   ```

2. **📦 Install dependencies**
   ```bash
   npm install
   ```

3. **🔧 Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **🚀 Run development server**
   ```bash
   npm run dev
   ```

---

## 🔐 Environment Variables

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

---

## 🏗️ Architecture Highlights

- **🧩 Component-based architecture** with reusable UI components
- **🪝 Custom hooks** for data fetching and real-time subscriptions
- **🔒 Type-safe** development with TypeScript throughout
- **⚡ Real-time capabilities** without performance penalties
- **📈 Scalable design** supporting multiple concurrent competitions

---

## 🎨 Design System

The application uses a carefully crafted piano-themed color palette:

- **🍷 Piano Wine**: Primary brand color for headers and important elements
- **🌟 Piano Gold**: Accent color for highlights and interactive elements  
- **🌸 Piano Cream**: Soft background color for cards and sections

---

## 🙏 Acknowledgments

- Built with ❤️ for music education and competition organizers
- Special thanks to the piano competition community for inspiration
- Powered by the amazing Supabase and Clerk platforms

---

<div align="center">

**🎹 This system successfully handles the complex requirements of music competition scoring while maintaining real-time performance and user experience! 🎹**

</div> 