# CogniGuide: AI-Powered Study Assistant

## Executive Overview

CogniGuide is an innovative SaaS platform that transforms educational content into interactive learning tools using artificial intelligence. The platform specializes in converting documents, slides, and notes into visual mind maps and intelligent flashcards, enhanced with scientifically-proven spaced repetition algorithms.

**Core Value Proposition**: "Learn Faster. Remember More. Ace Your Exams."

## Target Audience & Use Cases

### Primary Users
- **Students**: High school, college, and graduate students preparing for exams
- **Educators**: Teachers creating study materials and lesson plans
- **Professionals**: Individuals studying for certifications, continuing education, or skill development
- **Lifelong Learners**: Anyone seeking efficient ways to retain information from documents

### Key Use Cases
1. **Exam Preparation**: Convert textbooks, lecture notes, and study guides into interactive study tools
2. **Professional Development**: Process training materials, manuals, and certification content
3. **Research Organization**: Transform research papers and articles into structured knowledge maps
4. **Content Creation**: Educators converting lesson plans into engaging study materials
5. **Knowledge Management**: Organize and retain information from business documents and reports

## Core Features & User Experience

### Document Processing Capabilities
- **Supported Formats**: PDF, DOCX, PPTX, TXT, Markdown, and images (PNG/JPG/WebP/GIF)
- **OCR Integration**: Advanced image processing for diagrams and handwritten notes
- **Smart File Caching**: Intelligent preprocessing prevents redundant document analysis
- **Large File Support**: Handles files up to 50MB through optimized cloud storage
- **Batch Processing**: Multiple file uploads with automatic content consolidation

### AI-Powered Generation
- **Mind Maps**: Hierarchical visual representations of complex topics
  - Interactive zooming and panning
  - Collapsible node structures
  - Export options (HTML, SVG, PNG, PDF)
  - Real-time streaming generation for immediate feedback
- **Flashcards**: Intelligent question-answer pairs
  - Automated content extraction and formatting
  - Spaced repetition scheduling (TS-FSRS algorithm)
  - Study progress tracking and analytics

### User Interface & Experience
- **Landing Page**: Clean, conversion-optimized design with interactive demos
- **Authentication**: Email magic link and Google OAuth integration
- **Dashboard**: Unified history view of all generated content
- **Mobile Responsive**: Touch-optimized interface for mobile learning
- **Dark/Light Mode**: Theme switching for different study environments

### Advanced Learning Features
- **Spaced Repetition System**: Research-backed algorithm optimizing review timing
- **Progress Tracking**: Detailed analytics on study sessions and retention
- **Persistent Study Sessions**: Resume studying exactly where you left off
- **Cross-Device Synchronization**: Study progress syncs across devices
- **Exam Date Integration**: Adjusts study schedules around important deadlines

## Pricing Structure & Monetization

### Current Pricing Tiers

#### Free Tier
- **Target**: Trial users and basic learners
- **Monthly Credits**: 50 credits
- **Features**: Full access to mind maps and flashcards
- **Limitations**: Content length restrictions (approximately 19,000 characters)
- **No-Signup Generations**: 3 free generations for anonymous users

#### Student Tier ($4.99/month, $49.99/year)
- **Target**: Individual students and casual learners
- **Monthly Credits**: 300 credits
- **Features**: All core features + extended content limits
- **Value Proposition**: "Plenty of credits for regular study and exam prep"
- **Annual Savings**: 2 months free when paid annually

#### Pro Tier ($9.99/month, $99.99/year)
- **Target**: Power users and professionals
- **Monthly Credits**: 1,000 credits
- **Features**: All features + maximum content processing capacity
- **Value Proposition**: "For power users with high-volume needs"
- **Annual Savings**: 2 months free when paid annually

### Credit System Mechanics

#### Credit Consumption Rules
- **Base Rate**: 1 credit = 3,800 characters of processed content
- **Minimum Charge**: 0.5 credits for image-only processing
- **File-Based Generation**: At least 1 credit per generation
- **Prompt-Only Generation**: At least 1 credit, scales with content length
- **Content Limits by Tier**:
  - Free: 19,000 characters (5 credits worth)
  - Student: 114,000 characters (30 credits worth)
  - Pro: Unlimited within credit allocation

#### Credit Management
- **Monthly Refills**: Automatic credit replenishment on subscription renewal
- **Real-time Balance Updates**: Instant credit balance synchronization
- **Usage Tracking**: Detailed consumption analytics
- **Credit Optimization**: Intelligent content truncation when limits exceeded

### Payment Integration
- **Paddle Billing**: Enterprise-grade payment processing
- **Subscription Management**: Automated billing and plan changes
- **Localized Pricing**: Dynamic price display in user's currency
- **Webhook Integration**: Real-time subscription status updates
- **Trial Management**: Seamless upgrade flows from free to paid

## Technical Architecture

### Frontend Stack
- **Framework**: Next.js 15 (React 19)
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React hooks with Supabase real-time subscriptions
- **Analytics**: PostHog integration for user behavior tracking

### Backend Infrastructure
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with email and OAuth
- **File Storage**: Supabase Storage for document processing
- **AI Integration**: OpenAI Gemini 2.5 Flash Lite API
- **Deployment**: Vercel platform with edge computing

### Key Technical Features
- **Streaming Generation**: Real-time content generation with progressive UI updates
- **Smart Caching**: Multi-layer caching system for performance optimization
- **File Processing Pipeline**: Automated document parsing and content extraction
- **Real-time Synchronization**: Live updates across devices and sessions

## Market Positioning & Competitive Analysis

### Competitive Advantages
1. **Dual Output Formats**: Unique combination of mind maps AND flashcards from single input
2. **Advanced AI Processing**: Multimodal understanding (text + images + diagrams)
3. **Research-Backed Learning**: Integration of proven spaced repetition algorithms
4. **Seamless User Experience**: No complex setup, works directly from documents
5. **Scalable Pricing**: Credit-based system adapts to different usage patterns

### Market Differentiation
- **vs. Anki/Notion**: More automated content creation, visual learning tools
- **vs. Mind mapping tools**: AI-powered generation, integrated spaced repetition
- **vs. Document processing tools**: Educational focus with learning science integration
- **vs. Study platforms**: Lower friction, direct document-to-study-material conversion

### Target Market Size
- **Education Technology**: $315B global market (2024)
- **Online Learning**: $300B+ annual spend
- **Student Population**: 1.8B+ worldwide
- **Professional Learning**: $200B+ corporate training market

## Growth Opportunities & Pricing Strategy

### Expansion Opportunities
1. **Enterprise Solutions**: Team collaboration features, admin dashboards
2. **Educational Institutions**: Bulk licensing, integration with LMS platforms
3. **Mobile Applications**: Dedicated iOS/Android apps for on-the-go studying
4. **API Access**: Developer tools for third-party integrations
5. **White-label Solutions**: Custom-branded versions for educational platforms

### Pricing Strategy Considerations

#### Current Strengths
- **Freemium Model**: Effective conversion funnel with 3 free generations
- **Credit-Based Pricing**: Flexible consumption model appeals to different user types
- **Annual Discounts**: 17% savings encourages long-term commitment
- **Clear Value Anchoring**: Feature differentiation between tiers

#### Potential Optimization Areas
1. **Usage-Based Pricing**: Dynamic pricing based on actual consumption patterns
2. **Feature Tiers**: Advanced features (collaboration, advanced analytics) as premium add-ons
3. **Enterprise Pricing**: Volume discounts and custom feature sets
4. **Regional Pricing**: Localized pricing for different markets
5. **Add-on Services**: Premium AI models, priority processing, advanced export options

### Revenue Optimization Strategies
1. **Upgrade Flow Optimization**: Seamless conversion from free to paid
2. **Credit Pack Add-ons**: One-time credit purchases for heavy users
3. **Referral Program**: Incentivized user acquisition
4. **Partnership Revenue**: Integration partnerships with educational platforms

## User Journey & Conversion Funnel

### Acquisition Funnel
1. **Discovery**: SEO-optimized landing page, social media, educational content
2. **Trial**: 3 free generations with clear upgrade prompts
3. **Conversion**: Smooth upgrade flow with Paddle checkout
4. **Retention**: Regular usage through spaced repetition features
5. **Expansion**: Credit upgrades and feature adoption

### Key Conversion Points
- **Free Trial Exhaustion**: Clear upgrade messaging when free generations are used
- **Content Limits**: "Upgrade to process larger documents" prompts
- **Feature Gating**: Advanced features encourage plan upgrades
- **Usage Analytics**: Showing value through study progress and time saved

## Risk Assessment & Mitigation

### Technical Risks
- **AI API Costs**: OpenAI pricing fluctuations and rate limits
- **File Processing**: Large file handling and processing time
- **Scalability**: Database performance with growing user base

### Business Risks
- **Competition**: New entrants in AI-powered education space
- **Market Saturation**: Education technology becoming crowded
- **Regulatory Changes**: Data privacy and AI usage regulations

### Mitigation Strategies
- **Cost Optimization**: Efficient caching and processing optimization
- **Scalable Architecture**: Cloud-native infrastructure supporting growth
- **Competitive Monitoring**: Regular market analysis and feature development
- **Compliance**: Proactive adherence to data protection regulations

## Future Roadmap & Monetization Potential

### Short-term (6-12 months)
- **Mobile App Launch**: Native iOS/Android applications
- **Advanced Analytics**: Detailed learning progress dashboards
- **Team Collaboration**: Shared study materials and group features
- **Integration APIs**: Third-party tool integrations

### Long-term (1-2 years)
- **Enterprise Platform**: B2B solutions for educational institutions
- **AI Model Expansion**: Support for additional AI providers and models
- **Content Marketplace**: User-generated study materials marketplace
- **Global Expansion**: Localized content and international pricing

### Revenue Projections
- **Current Scale**: Freemium model driving organic growth
- **Projected Growth**: 10x user base with enterprise expansion
- **Revenue Streams**: Subscription (primary), add-ons, enterprise licensing
- **Market Opportunity**: $5B+ addressable market in AI-powered education

This comprehensive overview demonstrates CogniGuide's strong positioning in the emerging AI-powered education market, with a scalable pricing model and clear path to significant revenue growth.
