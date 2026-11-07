import assert from 'node:assert/strict';
import test from 'node:test';
import { TavilyNoticeProvider } from './tavily.js';
import { Website } from './types.js';

const btebWebsite: Website = {
  id: 'bteb-gov-bd',
  name: 'BTEB',
  nameBn: 'বিটিইবি',
  url: 'https://bteb.gov.bd/pages/notices',
  selector: 'tavily-extract',
  category: 'board',
  intervalMinutes: 60,
  enabled: true,
  fetchMode: 'tavily',
  createdAt: '2026-01-01T00:00:00.000Z'
};

test('Tavily extracts the exact configured page and parses BTEB notice rows', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const provider = new TavilyNoticeProvider('tvly-test-key', async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      results: [{
        url: btebWebsite.url,
        raw_content: [
          '## নোটিশ',
          '| নং | শিরোনাম | ফাইল সমূহ | ইমেজ | প্রকাশের তারিখ | কার্যকলাপ |',
          '| --- | --- | --- | --- | --- | --- |',
          '| ১ | নতুন পরীক্ষার বিজ্ঞপ্তি | | | ০৫-১১-২০২৬ | [দেখুন](/pages/notices/exam-123) |',
          '| ২ | ক্ষতিকর লিংক | | | ০৫-১১-২০২৬ | [দেখুন](https://attacker.example/notice) |',
          '| ৩ | নতুন পরীক্ষার বিজ্ঞপ্তি | | | ০৫-১১-২০২৬ | [দেখুন](/pages/notices/exam-123) |'
        ].join('\n')
      }],
      failed_results: []
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  const notices = await provider.fetchNotices(btebWebsite);

  assert.equal(requestUrl, 'https://api.tavily.com/extract');
  assert.equal(requestInit?.method, 'POST');
  assert.equal(new Headers(requestInit?.headers).get('Authorization'), 'Bearer tvly-test-key');
  const body = JSON.parse(String(requestInit?.body));
  assert.equal(body.urls, btebWebsite.url);
  assert.equal(body.extract_depth, 'advanced');
  assert.equal(body.format, 'markdown');
  assert.deepEqual(notices, [{
    title: 'নতুন পরীক্ষার বিজ্ঞপ্তি',
    link: 'https://bteb.gov.bd/pages/notices/exam-123',
    publishDate: '০৫-১১-২০২৬'
  }]);
});

test('Tavily parses the MRIST JSON notice feed newest first', async () => {
  const website: Website = {
    ...btebWebsite,
    id: 'mrist-notices',
    url: 'https://mrist.edu.bd/notices',
    tavilyExtractUrl: 'https://mrist.edu.bd/notices-datatable'
  };
  const provider = new TavilyNoticeProvider('tvly-test-key', async () => new Response(JSON.stringify({
    results: [{
      url: website.tavilyExtractUrl,
      raw_content: '{"draw":0,"data":{"id":10,"cat\\_name":"Older notice","description":"x","created\\_at":"01 Nov 2026"}{"id":11,"cat\\_name":"&quot;Latest&quot; notice","description":"x","created\\_at":"05 Nov 2026"}}'
    }]
  }), { status: 200 }));

  assert.deepEqual(await provider.fetchNotices(website), [
    {
      title: '"Latest" notice',
      link: 'https://mrist.edu.bd/view-notice/11',
      publishDate: '05 Nov 2026'
    },
    {
      title: 'Older notice',
      link: 'https://mrist.edu.bd/view-notice/10',
      publishDate: '01 Nov 2026'
    }
  ]);
});

test('Tavily parses dated DUET notice headings without category navigation links', async () => {
  const website: Website = {
    ...btebWebsite,
    id: 'duet-notices',
    url: 'https://www.duet.ac.bd/notice/all-notices'
  };
  const provider = new TavilyNoticeProvider('tvly-test-key', async () => new Response(JSON.stringify({
    results: [{
      url: website.url,
      raw_content: [
        '# All **Notice**',
        '05 NOV 2026',
        '###### [শাস্তির নোটিশ]( https://www.duet.ac.bd/notice/others/2519/notice )',
        '[Others](https://www.duet.ac.bd/notice/others#)',
        '04 NOV 2026',
        '###### [Academic notice](https://www.duet.ac.bd/notice/academic-notices/2511/result)'
      ].join('\n')
    }]
  }), { status: 200 }));

  assert.deepEqual(await provider.fetchNotices(website), [
    {
      title: 'শাস্তির নোটিশ',
      link: 'https://www.duet.ac.bd/notice/others/2519/notice',
      publishDate: '05 NOV 2026'
    },
    {
      title: 'Academic notice',
      link: 'https://www.duet.ac.bd/notice/academic-notices/2511/result',
      publishDate: '04 NOV 2026'
    }
  ]);
});

test('Tavily provider fails closed when the API key is missing', async () => {
  const provider = new TavilyNoticeProvider('', async () => {
    throw new Error('fetch should not be called');
  });

  await assert.rejects(provider.fetchNotices(btebWebsite), /TAVILY_API_KEY is not configured/);
});

test('Tavily provider surfaces API failures without leaking response content', async () => {
  const provider = new TavilyNoticeProvider('tvly-test-key', async () => {
    return new Response('sensitive upstream details', { status: 401 });
  });

  await assert.rejects(provider.fetchNotices(btebWebsite), /Tavily request failed with status 401/);
});
