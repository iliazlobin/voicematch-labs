import { Actor } from 'apify';
import { Dataset, createPlaywrightRouter } from 'crawlee';

export const router = createPlaywrightRouter();

export interface Input {
    limit?: number;
    timeout?: number;
}

router.addDefaultHandler(async ({ enqueueLinks, log, infiniteScroll, page }) => {
    const url = new URL( page.url());
    if (!(url.searchParams.has('source') && url.searchParams.get('source') == 'EVENTS')) {
        return;
    }

    const input = await Actor.getInput<Input>();
    const limit = input?.limit || 100;
    const timeout = input?.timeout || 30;

    log.info('Input: ', { limit, timeout });

    await infiniteScroll({
        timeoutSecs: timeout,
        waitForSecs: 1,
        scrollDownAndUp: true,
        stopScrollCallback: async () => {
            const events = await page.$$('div[data-recommendationid]');
            console.debug('events: ', events.length );
            return events.length >= limit || events.length == 0;
        },
    });

    const events = await page.$$('div[data-recommendationid]');
    console.debug('events final: ', events.length );

    log.info(`enqueueing eventDetails URLs`);
    await enqueueLinks({
        globs: ['https://www.meetup.com/*/events/*'],
        label: 'eventDetails',
    });
});

router.addHandler('eventDetails', async ({ request, page, log }) => {
    const title = await page.title();
    const description = await page.textContent('div[data-event-label="event-home"]', { strict: true });
    const time = await page.textContent('time[class]');
    const location = await page.textContent('div[data-testid="location-info"]', { strict: true });

    log.info(`${title}`, { url: request.loadedUrl, time, location });

    await Dataset.pushData({
        url: request.loadedUrl,
        title,
        description,
        time,
        location,
    });
});
