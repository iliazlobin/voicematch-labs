/**
 * This template is a production ready boilerplate for developing with `PlaywrightCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

// For more information, see https://docs.apify.com/sdk/js
import { Actor } from 'apify';
// For more information, see https://crawlee.dev
import { PlaywrightCrawler } from 'crawlee';
import { router } from './routes.js';

// Initialize the Apify SDK
await Actor.init();

const startUrls = ['https://www.meetup.com/find?source=EVENTS&location=us--ny--New%20York'];
//
const proxyConfiguration = await Actor.createProxyConfiguration({useApifyProxy: false});

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    requestHandler: router,
});

await crawler.run(startUrls);

// Exit successfully
await Actor.exit();
