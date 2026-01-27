// @ts-ignore
import NLP from 'node-nlp';
const { NlpManager } = NLP;
import mongoose from 'mongoose';
import { Settings } from '../models/Settings.js';
import { BotKnowledge } from '../models/BotKnowledge.js';

class BotService {
  private manager: any;
  private isTrained: boolean = false;

  constructor() {
    this.manager = new NlpManager({ languages: ['en', 'te', 'hi', 'ta', 'ml', 'pa'], forceNER: true });
    this.initialize();
  }

  private async waitForDbReady(timeoutMs: number) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (mongoose.connection.readyState === 1) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return mongoose.connection.readyState === 1;
  }

  private async initialize() {
    // ... (keep all existing static training data) ...
    // 1. Greetings (English)
    this.manager.addDocument('en', 'hello', 'greetings.hello');
    this.manager.addDocument('en', 'hi', 'greetings.hello');
    this.manager.addDocument('en', 'hey', 'greetings.hello');
    this.manager.addDocument('en', 'good morning', 'greetings.hello');
    this.manager.addDocument('en', 'good evening', 'greetings.hello');
    this.manager.addDocument('en', 'howdy', 'greetings.hello');
    this.manager.addDocument('en', 'hiya', 'greetings.hello');
    this.manager.addDocument('en', 'greetings', 'greetings.hello');
    this.manager.addDocument('en', 'yo', 'greetings.hello');
    this.manager.addDocument('en', 'what\'s up', 'greetings.hello');

    // Initial multilingual greeting
    const multilingualGreeting = 'Hello! Please select your language / దయచేసి మీ భాషను ఎంచుకోండి / कृपया अपनी भाषा चुनें: English, Telugu, Hindi, Tamil, Malayalam, Punjabi';
    this.manager.addAnswer('en', 'greetings.hello', multilingualGreeting);

    // Language Selection Intents
    this.manager.addDocument('en', 'english', 'lang.en');
    this.manager.addDocument('en', 'i want english', 'lang.en');
    this.manager.addAnswer('en', 'lang.en', 'Great! I will assist you in English. How can I help you today?');

    this.manager.addDocument('en', 'telugu', 'lang.te');
    this.manager.addDocument('en', 'telugu language', 'lang.te');
    this.manager.addAnswer('en', 'lang.te', 'Namaste! Nenu miku Telugu lo sahayam chestanu. Miku em kavalenu?');

    this.manager.addDocument('en', 'hindi', 'lang.hi');
    this.manager.addDocument('en', 'hindi language', 'lang.hi');
    this.manager.addAnswer('en', 'lang.hi', 'Namaste! Main aapse Hindi mein baat karunga. Bataiye main kaise madad kar sakta hoon?');

    this.manager.addDocument('en', 'tamil', 'lang.ta');
    this.manager.addAnswer('en', 'lang.ta', 'Vanakkam! Naan ungalukku Tamilil udavugiren.');

    this.manager.addDocument('en', 'malayalam', 'lang.ml');
    this.manager.addAnswer('en', 'lang.ml', 'Namaskaram! Njan ningale Malayalathil sahayam cheyyam.');

    this.manager.addDocument('en', 'punjabi', 'lang.pa');
    this.manager.addAnswer('en', 'lang.pa', 'Sat Sri Akal! Main tuhade naal Punjabi vich gal karanga.');

    // Telugu Greetings
    this.manager.addDocument('te', 'hello', 'greetings.hello');
    this.manager.addDocument('te', 'namaste', 'greetings.hello');
    this.manager.addDocument('te', 'ela unnaru', 'greetings.hello');
    this.manager.addAnswer('te', 'greetings.hello', 'Namaste! GoMandap ki swagatham. Nenu miku ela sahayam cheyagalanu?');

    // Hindi Greetings
    this.manager.addDocument('hi', 'hello', 'greetings.hello');
    this.manager.addDocument('hi', 'namaste', 'greetings.hello');
    this.manager.addDocument('hi', 'kaise ho', 'greetings.hello');
    this.manager.addAnswer('hi', 'greetings.hello', 'Namaste! GoMandap mein aapka swagat hai. Main aapki kaise madad kar sakta hoon?');

    // Tamil Greetings
    this.manager.addDocument('ta', 'hello', 'greetings.hello');
    this.manager.addDocument('ta', 'vanakkam', 'greetings.hello');
    this.manager.addAnswer('ta', 'greetings.hello', 'Vanakkam! GoMandap-ku varaverkirom. Ungalukku eppadi udava mudiyum?');

    // Malayalam Greetings
    this.manager.addDocument('ml', 'hello', 'greetings.hello');
    this.manager.addDocument('ml', 'namaskaram', 'greetings.hello');
    this.manager.addAnswer('ml', 'greetings.hello', 'Namaskaram! GoMandap-ilekku swagatham. Enikku engane സഹായിkkanam?');

    // Punjabi Greetings
    this.manager.addDocument('pa', 'hello', 'greetings.hello');
    this.manager.addDocument('pa', 'sat sri akal', 'greetings.hello');
    this.manager.addDocument('pa', 'ki haal hai', 'greetings.hello');
    this.manager.addAnswer('pa', 'greetings.hello', 'Sat Sri Akal! GoMandap vich tuhada swagat hai. Main tuhadi ki madad kar sakda haan?');

    // 2. Profile & Settings
    this.manager.addDocument('en', 'how do i update my profile', 'profile.update');
    this.manager.addDocument('en', 'change profile picture', 'profile.update');
    this.manager.addDocument('en', 'edit my details', 'profile.update');
    this.manager.addDocument('en', 'update business info', 'profile.update');

    this.manager.addAnswer('en', 'profile.update', 'You can update your profile details and business information in the "Settings" tab of your dashboard.');

    // 3. Verification
    this.manager.addDocument('en', 'when will i be verified', 'verification.status');
    this.manager.addDocument('en', 'how long does verification take', 'verification.status');
    this.manager.addDocument('en', 'am i verified', 'verification.status');
    this.manager.addDocument('en', 'verification process', 'verification.status');

    this.manager.addAnswer('en', 'verification.status', 'Verification usually takes 24-48 hours after you have submitted all required documents. You will be notified via email.');

    // 4. Pricing & Packages
    this.manager.addDocument('en', 'add new package', 'pricing.add');
    this.manager.addDocument('en', 'change price', 'pricing.update');
    this.manager.addDocument('en', 'update pricing', 'pricing.update');
    this.manager.addDocument('en', 'manage packages', 'pricing.manage');

    this.manager.addAnswer('en', 'pricing.add', 'To add or manage packages, go to your Profile section. You can list multiple packages with different amenities.');
    this.manager.addAnswer('en', 'pricing.update', 'You can edit your pricing at any time from the Profile or Settings section.');

    // 5. Bookings
    this.manager.addDocument('en', 'how do i see bookings', 'bookings.view');
    this.manager.addDocument('en', 'where are my orders', 'bookings.view');
    this.manager.addDocument('en', 'manage bookings', 'bookings.view');

    this.manager.addAnswer('en', 'bookings.view', 'You can view all your incoming inquiries and confirmed bookings in the "Bookings" tab on the left sidebar.');

    // 6. Support Handover / Contact
    this.manager.addDocument('en', 'talk to human', 'agent.contact');
    this.manager.addDocument('en', 'i need real support', 'agent.contact');
    this.manager.addDocument('en', 'call me', 'agent.contact');
    this.manager.addDocument('en', 'contact support', 'agent.contact');
    this.manager.addDocument('en', 'customer care', 'agent.contact');
    this.manager.addDocument('en', 'phone number', 'agent.contact');
    this.manager.addDocument('en', 'whatsapp support', 'agent.contact');
    this.manager.addDocument('en', 'email support', 'agent.contact');

    this.manager.addAnswer('en', 'agent.contact', '{{CONTACT_INFO}}');

    // 7. General Platform Questions
    this.manager.addDocument('en', 'what is gomandap', 'platform.info');
    this.manager.addDocument('en', 'how does this work', 'platform.info');
    this.manager.addDocument('en', 'is it free', 'platform.cost');
    this.manager.addDocument('en', 'pricing model', 'platform.cost');
    this.manager.addDocument('en', 'commission', 'platform.cost');

    this.manager.addAnswer('en', 'platform.info', 'GoMandap is India\'s first open-source platform for event vendors. We connect Mandap, Decor, Catering, Entertainment, and Photography professionals with customers.');
    this.manager.addAnswer('en', 'platform.cost', 'GoMandap is free to join! There are no hidden fees or credit cards required to sign up.');

    // 8. Specific Vendor Services
    this.manager.addDocument('en', 'mandap services', 'vendor.mandap');
    this.manager.addDocument('en', 'catering menu', 'vendor.catering');
    this.manager.addDocument('en', 'photography styles', 'vendor.photography');

    this.manager.addAnswer('en', 'vendor.mandap', 'For Mandap vendors, you can list details like capacity, venue type (Indoor/Outdoor), rooms, and amenities.');
    this.manager.addAnswer('en', 'vendor.catering', 'Caterers can list cuisines, dietary options (Veg/Non-Veg), and service styles.');
    this.manager.addAnswer('en', 'vendor.photography', 'Photographers can showcase styles (Candid, Traditional), deliverables, and equipment.');

    // 9. Dashboard Navigation
    this.manager.addDocument('en', 'where is settings', 'nav.settings');
    this.manager.addDocument('en', 'find bookings', 'nav.bookings');
    this.manager.addDocument('en', 'check inquiries', 'nav.inquiries');
    this.manager.addDocument('en', 'logout', 'nav.logout');

    this.manager.addAnswer('en', 'nav.settings', 'You can find "Settings" in the sidebar menu. It allows you to manage your account details.');
    this.manager.addAnswer('en', 'nav.bookings', 'The "Bookings" tab in the sidebar shows all your confirmed events.');
    this.manager.addAnswer('en', 'nav.inquiries', 'Check the "Inquiries" tab to see new messages from potential clients.');
    this.manager.addAnswer('en', 'nav.logout', 'You can sign out by clicking the "Sign Out" button at the bottom of the sidebar.');

    // 10. Terms & Conditions
    this.manager.addDocument('en', 'escrow protection', 'tc.escrow');
    this.manager.addDocument('en', 'payment release', 'tc.escrow');
    this.manager.addDocument('en', 'when do i get paid', 'tc.escrow');
    this.manager.addDocument('en', 'milestone payments', 'tc.escrow');

    this.manager.addAnswer('en', 'tc.escrow', 'Payments are secure in our Escrow system and released based on milestones (e.g., 20% on booking, 50% on start, 30% on completion).');

    this.manager.addDocument('en', 'gst compliance', 'tc.gst');
    this.manager.addDocument('en', 'tax', 'tc.gst');
    this.manager.addDocument('en', 'invoice', 'tc.gst');

    this.manager.addAnswer('en', 'tc.gst', 'Vendors are responsible for collecting and remitting GST. Split invoicing is used: you invoice for service, GoMandap invoices for platform fees.');

    this.manager.addDocument('en', 'platform fee', 'tc.fees');
    this.manager.addDocument('en', 'how much does gomandap charge', 'tc.fees');
    this.manager.addDocument('en', 'annual fee', 'tc.fees');

    this.manager.addAnswer('en', 'tc.fees', 'A nominal fee of ₹500/year applies only after you start acquiring clients. It is deducted from your first payout.');

    this.manager.addDocument('en', 'emi', 'tc.emi');
    this.manager.addDocument('en', 'financing', 'tc.emi');

    this.manager.addAnswer('en', 'tc.emi', 'We offer EMI to clients via partners. You still receive full payment as per the escrow schedule, regardless of the client\'s EMI tenure.');

    this.manager.addDocument('en', 'cancellation policy', 'tc.cancel');
    this.manager.addDocument('en', 'refund', 'tc.cancel');

    this.manager.addAnswer('en', 'tc.cancel', 'Cancellations follow the policy you selected (Strict/Flexible). Platform fees are non-refundable once booked.');

    // 11. Onboarding & Vendor Contact
    this.manager.addDocument('en', 'onboarding process', 'vendor.onboarding');
    this.manager.addDocument('en', 'how to join', 'vendor.onboarding');
    this.manager.addDocument('en', 'sign up', 'vendor.onboarding');
    this.manager.addDocument('en', 'registration', 'vendor.onboarding');
    this.manager.addDocument('en', 'how to register', 'vendor.onboarding');
    this.manager.addDocument('en', 'process to join', 'vendor.onboarding');
    this.manager.addDocument('en', 'steps to sign up', 'vendor.onboarding');
    this.manager.addDocument('en', 'what do i need to sign up', 'vendor.onboarding');

    this.manager.addAnswer('en', 'vendor.onboarding', 'Joining GoMandap is easy! Just click "Get Started Free" on the homepage, sign up with your email or Google, and complete the 4-step profile setup (Business Details, Banking, Services, Photos).');

    this.manager.addDocument('en', 'vendor support number', 'agent.contact');
    this.manager.addDocument('en', 'help line', 'agent.contact');
    this.manager.addDocument('en', 'contact details', 'agent.contact');
    this.manager.addDocument('en', 'vendor number', 'agent.contact');
    this.manager.addDocument('en', 'support number', 'agent.contact');
    this.manager.addDocument('en', 'phone number for vendors', 'agent.contact');
    this.manager.addDocument('en', 'who do i call', 'agent.contact');
    this.manager.addDocument('en', 'call support', 'agent.contact');

    // --- Dynamic Knowledge from DB ---
    const dbReady = await this.waitForDbReady(5000);
    if (dbReady) {
      await this.loadDynamicKnowledge();
    }

    // Train the model
    await this.manager.train();
    this.manager.save();
    this.isTrained = true;
    console.log('Bot trained successfully with static and dynamic data!');
  }

  private async loadDynamicKnowledge() {
    try {
      const knowledge = await BotKnowledge.find({});
      knowledge.forEach((item: any) => {
        // Check for 'manual' type which has title/content instead of question/answer
        if (item.sourceType === 'manual' && item.title && item.content) {
          const intent = `manual.${item._id}`;
          // Add title as a document
          this.manager.addDocument('en', item.title.toLowerCase(), intent);
          // Also add common variations based on tags if available
          if (item.tags && Array.isArray(item.tags)) {
            const tagStr = item.tags.join(' ');
            this.manager.addDocument('en', tagStr, intent);
            this.manager.addDocument('en', `about ${item.title.toLowerCase()}`, intent);
            this.manager.addDocument('en', `what is ${item.title.toLowerCase()}`, intent);
          }
          this.manager.addAnswer('en', intent, item.content);
        }
        // Handle legacy Q&A format
        else if (item.question && item.answer) {
          const intent = `dynamic.${item._id}`;
          this.manager.addDocument('en', item.question.toLowerCase(), intent);
          this.manager.addAnswer('en', intent, item.answer);
        }
      });
      console.log(`Loaded ${knowledge.length} dynamic training items.`);
    } catch (error) {
      console.error('Error loading dynamic bot knowledge:', error);
    }
  }

  public async addKnowledge(question: string, answer: string, targetAudience: 'client' | 'vendor' | 'general' = 'general') {
    try {
      const newItem = await BotKnowledge.create({ question, answer, targetAudience });
      const intent = `dynamic.${newItem._id}`;
      this.manager.addDocument('en', question.toLowerCase(), intent);
      this.manager.addAnswer('en', intent, answer);
      return newItem;
    } catch (error) {
      throw error;
    }
  }

  public async retrain() {
    this.isTrained = false;
    await this.initialize();
  }

  public async processMessage(text: string): Promise<string | null> {
    if (!this.isTrained) {
      await this.initialize();
    }
    // Auto-detect language
    const response = await this.manager.process(text);

    // Only return answer if confidence is high enough
    if (response.intent !== 'None' && response.score > 0.5 && response.answer) {
      if (response.answer === '{{CONTACT_INFO}}') {
        try {
          const dbReady = mongoose.connection.readyState === 1 ? true : await this.waitForDbReady(2000);
          if (!dbReady) {
            return 'You can reach our support team via email or phone. I have marked this ticket for review.';
          }

          const settings = await Settings.findOne({ type: 'general' });
          if (settings) {
            return `You can reach us via:\n📧 Email: ${settings.supportEmail}\n📱 WhatsApp: ${settings.supportWhatsapp}\n📞 Phone: ${settings.supportPhone}\n\nI have also marked this ticket for human review.`;
          }
          return 'You can reach our support team via email or phone. I have marked this ticket for review.';
        } catch {
          return 'You can reach our support team via email or phone. I have marked this ticket for review.';
        }
      }
      return response.answer;
    }
    return null;
  }
}

export const botService = new BotService();
