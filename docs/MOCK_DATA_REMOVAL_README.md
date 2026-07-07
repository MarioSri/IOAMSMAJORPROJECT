# Mock Data Removal & Supabase Integration Documentation

## Overview

This documentation covers the implementation of removing mock recipient names from Profile and Dashboard pages for all roles except Demo Work, and integrating Supabase for real-time data.

## Quick Start

**New to this project?** Start here:
1. Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Developer quick reference
2. Read [DATA_FLOW_ARCHITECTURE.md](./DATA_FLOW_ARCHITECTURE.md) - System architecture
3. Read [PHASE1_IMPLEMENTATION_SUMMARY.md](./PHASE1_IMPLEMENTATION_SUMMARY.md) - What's been done

**Ready to implement Supabase?**
- Follow [PHASE2_CHECKLIST.md](./PHASE2_CHECKLIST.md) step by step

## Documentation Files

### Core Documentation

#### [DATA_FLOW_ARCHITECTURE.md](./DATA_FLOW_ARCHITECTURE.md)
Complete system architecture showing:
- Data flow diagrams
- Storage isolation patterns
- Error handling flows
- Component usage maps
- Phase 1 implementation details
- Phase 2 requirements

**Read this to understand:** How the entire system works

---

#### [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
Developer quick reference guide with:
- Code patterns and examples
- Common mistakes to avoid
- Debugging tips
- Component checklist

**Read this when:** Adding new components or features

---

#### [LOCALSTORAGE_RULES.md](./LOCALSTORAGE_RULES.md)
localStorage usage rules covering:
- What can/cannot be stored
- Key naming conventions
- Migration patterns
- Debugging tips

**Read this when:** Working with localStorage or user data

---

### Implementation Documentation

#### [PHASE1_IMPLEMENTATION_SUMMARY.md](./PHASE1_IMPLEMENTATION_SUMMARY.md)
Phase 1 completion summary including:
- What was implemented
- Files created/modified
- Key improvements
- Testing results
- Next steps

**Read this to understand:** What's already done

---

#### [PHASE2_CHECKLIST.md](./PHASE2_CHECKLIST.md)
Step-by-step Supabase integration guide:
- Installation steps
- Database setup
- Service updates
- Testing procedures
- Troubleshooting

**Follow this to:** Implement Supabase integration

---

## Key Concepts

### Data Source Tracking
Every component tracks where its data comes from:
- `'mock'` - Demo Work role, from MOCK_RECIPIENTS
- `'real'` - Real roles, from Supabase
- `'empty'` - No data available

### Role-Based Data Loading
```typescript
if (isAllowedMockData(user.role)) {
  // Load from MOCK_RECIPIENTS
} else {
  // Fetch from Supabase
}
```

### localStorage Separation
- **Identity data** (name, email, role) → NEVER in localStorage
- **Preference data** (settings, UI state) → Can use localStorage

### Visual Indicators
- Demo Mode: Amber badges and alerts
- Live Data: Green badges (optional)
- Consistent across all pages

## Implementation Status

### ✅ Phase 1: Foundation (COMPLETED)
- [x] Core utilities created (roleUtils.ts)
- [x] Services created (UserProfileService.ts)
- [x] Visual components created (DemoIndicator.tsx)
- [x] Profile page updated
- [x] Dashboard updated
- [x] RecipientSelector updated
- [x] AuthContext updated
- [x] Documentation created

### ⏳ Phase 2: Supabase Integration (PENDING)
- [ ] Supabase client installed
- [ ] Database schema created
- [ ] Real users added
- [ ] Services updated with queries
- [ ] Tested with real roles

### 📋 Phase 3: Validation (PENDING)
- [ ] All roles tested
- [ ] Error scenarios tested
- [ ] Performance verified
- [ ] Documentation updated

## File Structure

```
docs/
├── DATA_FLOW_ARCHITECTURE.md      # System architecture
├── QUICK_REFERENCE.md             # Developer quick reference
├── LOCALSTORAGE_RULES.md          # localStorage usage rules
├── PHASE1_IMPLEMENTATION_SUMMARY.md # Phase 1 summary
├── PHASE2_CHECKLIST.md            # Phase 2 implementation guide
└── README.md                      # This file

src/
├── utils/
│   └── roleUtils.ts               # Role checking utilities
├── services/
│   ├── UserProfileService.ts      # User profile fetching
│   └── RecipientService.ts        # Recipient list fetching
├── components/
│   └── ui/
│       └── DemoIndicator.tsx      # Visual indicators
├── pages/
│   └── Profile.tsx                # Profile page (updated)
├── components/
│   └── dashboard/
│       └── RoleDashboard.tsx      # Dashboard (updated)
└── contexts/
    └── AuthContext.tsx            # Auth context (updated)
```

## Common Tasks

### Adding a New Component That Displays User Data
1. Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
2. Follow the component checklist
3. Use the provided code patterns
4. Test with both demo and real roles

### Debugging Data Source Issues
1. Check console logs for data source tracking
2. Verify `isAllowedMockData()` is being used
3. Check localStorage for identity data (should be none)
4. Review [DATA_FLOW_ARCHITECTURE.md](./DATA_FLOW_ARCHITECTURE.md)

### Implementing Supabase
1. Follow [PHASE2_CHECKLIST.md](./PHASE2_CHECKLIST.md) step by step
2. Don't skip verification steps
3. Test thoroughly before moving to next step

### Understanding localStorage Rules
1. Read [LOCALSTORAGE_RULES.md](./LOCALSTORAGE_RULES.md)
2. Check the "Forbidden" vs "Allowed" sections
3. Use the provided key naming conventions

## Testing

### Manual Testing Checklist
- [ ] Log in as Demo Work → See mock data everywhere
- [ ] Log in as Principal → See real data from Supabase
- [ ] Log in as Registrar → See real data from Supabase
- [ ] Log in as HOD → See real data from Supabase
- [ ] Disconnect internet → See proper error messages
- [ ] Check localStorage → No identity data present
- [ ] Check console logs → Data sources tracked correctly

### Automated Testing (Future)
- Unit tests for roleUtils
- Integration tests for services
- E2E tests for user flows

## Troubleshooting

### Common Issues

**"Data source: empty" for real roles**
- Supabase not configured yet (Phase 2 pending)
- Check .env file for credentials
- Verify database has users

**Demo badges showing for real roles**
- Check if `isAllowedMockData()` is being used
- Verify role string is correct
- Check console logs for role detection

**Identity data in localStorage**
- Old code pattern still in use
- Review [LOCALSTORAGE_RULES.md](./LOCALSTORAGE_RULES.md)
- Clear localStorage and test again

**TypeScript errors**
- Run `npm install`
- Check imports are correct
- Verify types match interfaces

## Contributing

When adding new features:
1. Follow existing patterns (see QUICK_REFERENCE.md)
2. Track data source explicitly
3. Use centralized utilities (roleUtils.ts)
4. Add visual indicators for demo mode
5. Update documentation
6. Test with both demo and real roles

## Support

For questions or issues:
1. Check relevant documentation file
2. Review existing implementations (Profile.tsx, RoleDashboard.tsx)
3. Check console logs for debugging info
4. Review [DATA_FLOW_ARCHITECTURE.md](./DATA_FLOW_ARCHITECTURE.md) for architecture

## Version History

### v1.0 - Phase 1 Complete (Current)
- Foundation utilities implemented
- Profile and Dashboard updated
- Documentation created
- Ready for Supabase integration

### v2.0 - Phase 2 (Planned)
- Supabase integration complete
- Real data fetching working
- All roles tested

### v3.0 - Phase 3 (Future)
- Google OAuth integration
- Profile editing with Supabase
- Real-time updates
- User management interface
