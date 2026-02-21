# HND Gateway Subscription System Implementation

## 🎯 Overview

Complete subscription-based payment system with multiple plans and access control.

## 💰 Subscription Plans

### Course Access Plans

- **Per Course**: 75 XAF - Access specific course for 6 months
- **Weekly Plan**: 200 XAF - Access all courses for 1 week
- **Monthly Plan**: 500 XAF - Access all courses for 1 month
- **4-Month Plan**: 1500 XAF - Access all courses for 4 months

### AI Usage Plans

- **Free Tier**: 50 AI tokens per month
- **AI Monthly**: 500 XAF - Unlimited AI access for 1 month

## 🔧 Implementation Details

### New Models

- **Subscription**: Manages all subscription plans and status
- **User Updates**: Added AI token tracking and subscription status

### Controllers

- **SubscriptionController**: Handle plan subscriptions and access control
- **Updated PaymentController**: Process subscription webhooks

### Middleware

- **subscriptionAuth**: Access control for courses, tests, and AI
- **AI Token Management**: Automatic token consumption and limits

### Routes

- `/api/subscriptions/*` - Subscription management
- `/api/courses/public/*` - Course access with subscription
- Updated AI and test routes with access control

## 📱 User Flow

### After Signup

1. User is redirected to landing page (NOT payment)
2. User can browse courses but needs subscription for access
3. Clear messaging about subscription requirements

### Service Access Control

1. **Course Access**: Requires active course subscription
2. **Test Taking**: Requires test access subscription
3. **AI Usage**: Free 50 tokens, then requires AI subscription
4. **Automatic Expiration**: Blocks access when subscriptions expire

### Payment Integration

- All plans integrate with existing Nkwa Pay system
- Webhook processing activates subscriptions automatically
- Supports multiple active subscriptions per user

## 🔒 Access Control Features

### Automatic Checks

- Subscription status updated on each request
- Expired subscriptions automatically blocked
- Clear error messages with available plans

### Granular Permissions

- Per-course access for specific subscriptions
- General access for full plans
- AI token limits with upgrade prompts

## 🚀 API Endpoints

### Subscription Management

- `GET /api/subscriptions/plans` - Get available plans
- `POST /api/subscriptions/subscribe` - Subscribe to plan
- `GET /api/subscriptions/my-subscriptions` - User's subscriptions
- `GET /api/subscriptions/check-access` - Check service access

### Course Access

- `GET /api/courses/public` - Browse courses (no subscription needed)
- `GET /api/courses/public/:id` - Course details (requires subscription)
- `POST /api/courses/public/:id/enroll` - Enroll in course (requires subscription)

### Protected Services

- `POST /api/ai/chat` - AI chat (token limits apply)
- `POST /api/tests/:id/enroll` - Test enrollment (requires subscription)
- `POST /api/tests/:id/submit` - Test submission (requires subscription)

## ⚙️ Admin Features

- View all subscriptions with filtering
- Manual expiration checks
- Subscription analytics and management

## 🔄 Automatic Maintenance

- Monthly AI token reset for free users
- Automatic subscription expiration
- Webhook-based subscription activation

## 💡 Key Benefits

1. **Flexible Pricing**: Multiple plans for different needs
2. **Seamless Integration**: Works with existing Nkwa Pay system
3. **User-Friendly**: Clear messaging and upgrade prompts
4. **Scalable**: Easy to add new plans and features
5. **Secure**: Proper access control and validation
