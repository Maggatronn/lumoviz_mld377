# Lumoviz Documentation

Complete documentation for the Lumoviz organizing visualization platform.

## 📚 Documentation Index

### Setup & Configuration
- **[Setup New Instance](./SETUP_NEW_INSTANCE.md)** - Complete guide for setting up a new Lumoviz instance with your own data
- **[Switch to Demo Database](./SWITCH_TO_DEMO_DATABASE.md)** - Guide for switching between demo and production databases

### Core Systems
- **[Dynamic LOE System](./DYNAMIC_LOE_SYSTEM.md)** - Understanding the Level of Engagement (LOE) hierarchy and color system
- **[Campaign Migration Guide](./CAMPAIGN_MIGRATION_GUIDE.md)** - Guide for migrating and setting up campaign structures

### Feature Guides
- **[Person Mapping Guide](./SIMPLE_PERSON_MAPPING_GUIDE.md)** - How to map organizer names to VAN IDs for accurate tracking
- **[Person Mapping Implementation](./FRONTEND_PERSON_MAPPING_IMPLEMENTATION.md)** - Technical details of the person mapping system
- **[Edit Person Info in Mapping](./EDIT_PERSON_INFO_IN_MAPPING.md)** - How to add or edit person contact information through the mapping dialog
- **[Person Chip Usage Guide](./PERSON_CHIP_USAGE_GUIDE.md)** - How to use PersonChip components throughout the application

## 🗂️ Additional Documentation

### BigQuery Setup
See `/bigquery-setup/` folder for:
- Database schema setup scripts
- Migration files
- Data cleanup utilities

### Architecture
See `/src/ARCHITECTURE.md` for:
- Application architecture overview
- Component structure
- Data flow patterns

## 🚀 Quick Start

1. **Initial Setup**: Start with [Setup New Instance](./SETUP_NEW_INSTANCE.md)
2. **Configure LOE**: Review [Dynamic LOE System](./DYNAMIC_LOE_SYSTEM.md)
3. **Map Organizers**: Follow [Person Mapping Guide](./SIMPLE_PERSON_MAPPING_GUIDE.md)
4. **Set up Campaigns**: Use [Campaign Migration Guide](./CAMPAIGN_MIGRATION_GUIDE.md)

## 💡 Key Concepts

### Organizer Mapping
Lumoviz uses an organizer mapping system to handle cases where the same person appears with different VAN IDs or name variations across datasets. This ensures accurate attribution of organizing work.

### Dynamic LOE (Level of Engagement)
The system tracks and visualizes people's engagement levels, from initial contact through to leadership roles. The dynamic LOE system allows for customizable hierarchies.

### Campaign Actions
Actions can be one-time or recurring (rate-based), with support for multi-step workflows, goal tracking, and automatic resets for weekly/monthly/daily goals.

## 📊 Data Structure Requirements

When adapting Lumoviz for your organization, ensure your data includes:
- **Contacts**: VAN IDs, names, chapters, LOE status, membership status
- **Meetings/Conversations**: Organizer, participant, date, type, notes
- **Pledges**: Signer info, leader/collector, date
- **Teams**: Team members, chapters, hierarchy
- **Actions**: Configurable actions with fields, goals, and tracking

## 🔧 Development

For component documentation, see `/src/components/README.md`
