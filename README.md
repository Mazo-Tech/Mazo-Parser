# Mazo Beam Parser

A powerful web application for parsing resumes and job descriptions, matching candidates to positions, and generating comprehensive matching reports.

## 🚀 Features

- **Document Parsing**: Upload and parse PDF/DOCX resumes and job descriptions
- **Intelligent Matching**: Automatically match candidates to job descriptions based on skills and experience
- **Report Generation**: Export detailed matching reports to Excel
- **History Management**: View and manage your parsing history
- **User Management**: Admin panel for user management (admin role required)
- **Secure Authentication**: Built-in authentication with role-based access control

## 📋 Prerequisites

- Node.js 18+ or Bun
- npm, yarn, or bun package manager
- Supabase account and project
- OpenAI API key (for document parsing)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mazoparser-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Configure Supabase**
   - Set up your Supabase project
   - Run the database migrations (see `database_queries.sql`)
   - Configure Row Level Security (RLS) policies
   - Set up the Edge Function for document parsing

5. **Configure Edge Function**
   
   In your Supabase project, set the environment variable for the Edge Function:
   ```bash
   supabase secrets set GEMINI_API_KEY=your_gemini_api_key
   ```

## 🚀 Getting Started

1. **Start the development server**
   ```bash
   npm run dev
   # or
   bun dev
   ```

2. **Open your browser**
   - Navigate to `http://localhost:5173`
   - You'll be redirected to the login page

3. **Login**
   - Use your Supabase user credentials
   - If you're an admin, you'll have access to the User Management panel

## 📖 Usage Guide

### Uploading Job Descriptions

1. Click on "Upload Job Descriptions"
2. Select PDF or DOCX files (maximum 10 files)
3. Wait for parsing to complete
4. Review the parsed job descriptions

### Uploading Resumes

1. Click on "Upload Resumes"
2. Select PDF or DOCX files (maximum 25 files)
3. Wait for parsing to complete
4. View candidates with automatic matching percentages

### Generating Reports

1. Upload at least one job description and one resume
2. Click "Generate Report"
3. The system will:
   - Save the parsing history
   - Generate an Excel report
   - Clear the current uploads

### Viewing History

- Scroll down to see "Recent Reports"
- Click on any report to download it again
- Delete reports using the trash icon

### Admin Features

If you have admin privileges:
- Access the "User Management" section
- Add new users
- Delete users
- View all user profiles and roles

## 📁 Project Structure

```
mazoparser-main/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # UI component library (shadcn/ui)
│   │   ├── CandidateTable.tsx
│   │   ├── DocumentParser.tsx
│   │   ├── FileUpload.tsx
│   │   ├── JobDescription.tsx
│   │   ├── MatchingVisuals.tsx
│   │   ├── ParsingHistory.tsx
│   │   └── UserManagement.tsx
│   ├── pages/              # Page components
│   │   ├── Auth.tsx
│   │   ├── Index.tsx
│   │   └── NotFound.tsx
│   ├── utils/              # Utility functions
│   │   ├── parser/         # Document parsing utilities
│   │   ├── colorCoding.ts
│   │   └── geminiParser.ts
│   ├── integrations/       # External integrations
│   │   └── supabase/       # Supabase client and types
│   └── types/              # TypeScript type definitions
├── supabase/
│   └── functions/          # Edge Functions
│       └── parse-document/  # Document parsing function
└── public/                 # Static assets
```

## 🔧 Configuration

### File Upload Limits

- Maximum Job Descriptions: 10
- Maximum Resumes: 25
- Maximum Batch Size: 100 files per upload

### Supported File Formats

- PDF (`.pdf`)
- Microsoft Word (`.doc`, `.docx`)

## 🎨 Features in Detail

### Skill Matching Algorithm

The application uses an intelligent matching algorithm that:
- Performs exact skill matches
- Handles partial matches (e.g., "AWS Lambda" matches "AWS")
- Recognizes technology equivalents (e.g., "SQL" matches "MySQL", "PostgreSQL")
- Calculates match percentages based on required vs. candidate skills

### Color Coding

Results are color-coded for quick identification:
- 🟢 **Green (Select)**: 70%+ match
- 🟡 **Yellow (Hold)**: 40-69% match
- 🔴 **Red (Reject)**: Below 40% match

### Experience Matching

- Candidates are evaluated based on years of experience
- Results show "Qualified" or "Not Qualified" based on experience requirements

## 🐛 Troubleshooting

### Common Issues

1. **Parsing fails**
   - Check that your OpenAI API key is correctly set in Supabase Edge Function secrets
   - Ensure files are not corrupted
   - Verify file format is supported

2. **Authentication errors**
   - Verify Supabase credentials in `.env` file
   - Check that RLS policies are properly configured
   - Ensure user exists in Supabase Auth

3. **Upload limits exceeded**
   - Check current count of uploaded files
   - Remove existing files before uploading new ones
   - Respect the maximum limits (10 JDs, 25 resumes)

4. **Report generation fails**
   - Ensure both job descriptions and resumes are uploaded
   - Check browser console for errors
   - Verify user is authenticated

## 📝 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## 🔒 Security

- Row Level Security (RLS) enabled on all database tables
- User data isolation (users can only see their own data)
- Role-based access control (admin/user roles)
- Secure authentication via Supabase Auth
- API keys stored securely in environment variables

## 📊 Database

The application uses Supabase (PostgreSQL) with the following main tables:
- `profiles` - User profiles
- `user_roles` - User roles and permissions
- `parsing_history` - Historical parsing records

See `database_queries.sql` for complete database schema and queries.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review the technical documentation
- Contact the development team

## 🗺️ Roadmap

- [ ] Support for more file formats
- [ ] Advanced filtering and search
- [ ] Bulk operations
- [ ] Email notifications
- [ ] API endpoints for external integrations
- [ ] Enhanced analytics dashboard

---

**Built with using React, TypeScript, Supabase, and Gemini**

