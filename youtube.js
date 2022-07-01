const puppeteer = require('puppeteer');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const url = 'https://www.youtube.com/playlist?list=PLRBp0Fe2GpgnIh0AiYKh7o7HnYAej-5ph';

(async function(){
    try {
        const browserObj = await puppeteer.launch({
            headless : false,
            slowMo : true,
            defaultViewport : null,
            args : ["--start-maximized"]
        });

        const allTabsArr = await browserObj.pages();
        const currTab = allTabsArr[0];
        currTab.goto(url);

        await currTab.waitForSelector('h1#title');
        const playlistName = await currTab.evaluate(function(selector){
            return document.querySelector(selector).innerText;
        }, 'h1#title');

        await currTab.waitForSelector('#stats .style-scope.ytd-playlist-sidebar-primary-info-renderer');
        const allData = await currTab.evaluate(getData,'#stats .style-scope.ytd-playlist-sidebar-primary-info-renderer');

        const totalVideos = allData.numberOfVideos.replace(',', '').split(' ')[0];

        // Use await or else it will just return a promise and will not wait for it to resolve
        // Initially this will be the number of videos that are already loaded
        let currentVideos = await getCurrVideosLength(currTab);

        // It can happen that currentVideos may not be equal to totalVideos, don't know why
        // even though there are 1024 videos , youtube shows 1038 videos, so they will never become equal and loop will never end
        // To end the loop we do that whenever the difference between them gets lower than 20 , then it should stop
        while(parseInt(totalVideos) - currentVideos >= 20) {
            await scrollToBottom(currTab);
            currentVideos = await getCurrVideosLength(currTab);
        }

        const statsList = await getStats(currTab);

        let pdfDoc = new PDFDocument;
        pdfDoc.pipe(fs.createWriteStream('Youtube Playlist.pdf'));
        pdfDoc.text(JSON.stringify(statsList));
        pdfDoc.end();

    } catch (error) {
        console.log(error);
    }
})();


function getData(selector){
    const allElements = [...document.querySelectorAll(selector)];
    const numberOfVideos = allElements[0].innerText;
    const totalViews = allElements[1].innerText;
    return {
        numberOfVideos,
        totalViews
    };
}

async function getCurrVideosLength(currTab) {
    return await currTab.evaluate(getLength, '#container>#thumbnail span.style-scope.ytd-thumbnail-overlay-time-status-renderer');
}

function getLength(durationSelect) {
    // This will select all the videos currently loaded on the page and will return how many videos are loaded
    const durationElement = [...document.querySelectorAll(durationSelect)];
    return durationElement.length;
}

async function scrollToBottom(currTab) {
    await currTab.evaluate(goToBottom);
}

function goToBottom() {
    window.scrollBy(0, window.innerHeight);
}

async function getStats(currTab) {
    return await currTab.evaluate(getNameDuration, 'a#video-title', '#text.style-scope.ytd-thumbnail-overlay-time-status-renderer');
}

function getNameDuration(videoSelector, durationSelector) {
    const videoElement = [...document.querySelectorAll(videoSelector)];
    const durationElement = [...document.querySelectorAll(durationSelector)];

    const currentList = [];

    for(let i=0; i<durationElement.length; ++i) {
        const videoTitle = videoElement[i].innerText;
        const duration = durationElement[i].innerText;
        currentList.push({videoTitle, duration});
    }

    return currentList;
}