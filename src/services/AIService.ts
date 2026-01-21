import { botService } from './BotService.js';
import { BotKnowledge } from '../models/BotKnowledge.js';
import { Vendor } from '../models/Vendor.js';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class AIService {
  
  // --- Ingestion Methods ---

  async ingestPDF(buffer: Buffer, filename: string): Promise<any> {
    try {
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      const text = data.text;
      
      // Store in Knowledge Base
      const kb = await BotKnowledge.create({
        sourceType: 'pdf',
        sourceUrl: filename,
        title: `PDF: ${filename}`,
        content: text,
        tags: ['document', 'pdf']
      });
      
      // Trigger NLP retrain
      await botService.retrain();
      
      return kb;
    } catch (error) {
      console.error('PDF Ingest Error:', error);
      throw new Error('Failed to parse PDF');
    }
  }

  async ingestWeb(url: string): Promise<any> {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
      
      // Remove scripts, styles
      $('script').remove();
      $('style').remove();
      
      const title = $('title').text();
      const content = $('body').text().replace(/\s+/g, ' ').trim();
      
      const kb = await BotKnowledge.create({
        sourceType: 'web',
        sourceUrl: url,
        title: title || url,
        content: content.substring(0, 10000), // Limit size
        tags: ['web', 'scrape']
      });

      // Trigger NLP retrain
      await botService.retrain();
      
      return kb;
    } catch (error) {
      console.error('Web Ingest Error:', error);
      throw new Error('Failed to scrape URL');
    }
  }

  async ingestImage(buffer: Buffer, filename: string): Promise<any> {
    try {
      const worker = await createWorker('eng');
      const ret = await worker.recognize(buffer);
      const text = ret.data.text;
      await worker.terminate();
      
      const kb = await BotKnowledge.create({
        sourceType: 'image',
        sourceUrl: filename,
        title: `Image: ${filename}`,
        content: text,
        tags: ['image', 'ocr']
      });

      // Trigger NLP retrain
      await botService.retrain();
      
      return kb;
    } catch (error) {
      console.error('Image Ingest Error:', error);
      throw new Error('Failed to process image');
    }
  }

  // --- Analysis Methods ---

  async analyzeMarket(): Promise<string> {
    try {
      const vendors = await Vendor.find();
      const count = vendors.length;
      const byType: Record<string, number> = {};
      
      vendors.forEach(v => {
        // Count Types
        const type = v.vendorType || 'unknown';
        byType[type] = (byType[type] || 0) + 1;
      });

      let report = `Market Analysis Report:\nTotal Vendors: ${count}\n\nDistribution:\n`;
      for (const [t, c] of Object.entries(byType)) {
        report += `- ${t}: ${c} vendors\n`;
      }
      
      return report;
    } catch (error) {
      return "Failed to analyze market.";
    }
  }

  async searchInternal(query: string): Promise<any[]> {
    // Simple regex search or text search if index works
    // Fallback to regex for robustness in dev
    const regex = new RegExp(query.split(' ').join('|'), 'i');
    const results = await BotKnowledge.find({
      $or: [
        { content: regex },
        { title: regex },
        { question: regex }
      ]
    }).limit(3);
    
    return results;
  }

  // --- Web Search Removed (User Request) ---
  
  // --- Chat Method (Delegates to BotService NLP) ---
  
  async chat(query: string, context: any = {}): Promise<string> {
    const lowerQuery = query.toLowerCase();

    // 1. Analyze Intent (Internal Market Data)
    const analysisKeywords = ['analyze', 'analysis', 'trend', 'stats', 'number', 'count', 'report'];
    const targetKeywords = ['vendor', 'market', 'business', 'platform'];
    
    const hasAnalysisKeyword = analysisKeywords.some(k => lowerQuery.includes(k));
    const hasTargetKeyword = targetKeywords.some(k => lowerQuery.includes(k));

    if (hasAnalysisKeyword && hasTargetKeyword) {
        return await this.analyzeMarket();
    }

    // 2. Delegate to node-nlp (BotService) for robust intent matching
    const nlpResponse = await botService.processMessage(query);
    if (nlpResponse) {
        return nlpResponse;
    }

    // 3. Fallback: Simple Search Knowledge Base (Internal RAG)
    const docs = await this.searchInternal(query);
    if (docs.length > 0) {
      const best = docs[0];
      return `(Internal Knowledge) [${best.title}]:\n${best.content.substring(0, 500)}...\n\n`;
    }

    // 4. Final Fallback
    return "I couldn't find any information about that in my training data. Please train me on this topic via the Admin Panel.";
  }
}

export const aiService = new AIService();
