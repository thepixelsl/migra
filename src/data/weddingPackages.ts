import content from './pricing-page.json';
import {resolvePricingPackages,pricingText} from '../lib/pricing-content.mjs';
export const weddingGalleryMonths = content.galleryMonths;
export const weddingBookingHoursRule = pricingText(content.bookingRule, content);
export const weddingPackages = resolvePricingPackages(content);
