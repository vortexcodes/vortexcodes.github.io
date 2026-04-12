(function () {
    const TEAM_KEY = 'frc5940';
    const TEAM_NUM = 5940;
    const TBA_BASE = 'https://www.thebluealliance.com/api/v3';
    const STATBOTICS_BASE = 'https://api.statbotics.io/v3';
    const API_KEY = 'AXJEgHS1gv8SBtnQFAZinhvUwgqf9m9gdJZBhwdgNrsumbq2kWrW3YLxwxYIyR5W';
    const REFRESH_ACTIVE = 30000;
    const REFRESH_IDLE = 300000;

    const COMP_LEVELS = { qm: 'Quals', qf: 'Quarters', sf: 'Semis', f: 'Finals' };
    const COMP_ORDER = { qm: 0, qf: 1, sf: 2, f: 3 };

    let currentYear = new Date().getFullYear();
    let currentEventKey = null;
    let currentEventDetails = null;
    let predictions = {};
    let countdownInterval = null;
    let refreshTimer = null;

    // --- TBA API ---
    async function tbaFetch(endpoint) {
        var res = await fetch(TBA_BASE + endpoint, {
            headers: { 'X-TBA-Auth-Key': API_KEY }
        });
        if (!res.ok) {
            throw new Error(res.status === 401 ? 'Invalid API key' : 'API error ' + res.status);
        }
        return res.json();
    }

    function fetchEvents(year) { return tbaFetch('/team/' + TEAM_KEY + '/events/' + year); }
    function fetchMatches(eventKey) { return tbaFetch('/team/' + TEAM_KEY + '/event/' + eventKey + '/matches'); }
    function fetchTeamStatus(eventKey) { return tbaFetch('/team/' + TEAM_KEY + '/event/' + eventKey + '/status'); }
    function fetchRankings(eventKey) { return tbaFetch('/event/' + eventKey + '/rankings'); }
    function fetchEventDetails(eventKey) { return tbaFetch('/event/' + eventKey); }

    // --- Statbotics API ---
    async function fetchStatboticsMatches(eventKey) {
        try {
            var res = await fetch(STATBOTICS_BASE + '/matches?event=' + eventKey);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            return [];
        }
    }

    function buildPredictionMap(statMatches) {
        predictions = {};
        if (!Array.isArray(statMatches)) return;
        statMatches.forEach(function (m) {
            var key = m.key || m.match;
            if (!key) return;
            predictions[key] = {
                redWinProb: m.pred ? (m.pred.red_win_prob != null ? m.pred.red_win_prob : null) : null,
                redScore: m.pred ? m.pred.red_score : null,
                blueScore: m.pred ? m.pred.blue_score : null
            };
        });
    }

    function getOurWinProb(matchKey) {
        var pred = predictions[matchKey];
        if (!pred || pred.redWinProb == null) return null;
        // Figure out which alliance we're on from the stored match data
        return pred;
    }

    // --- Helpers ---
    function getTeamAlliance(match) {
        if (match.alliances.red.team_keys.includes(TEAM_KEY)) return 'red';
        if (match.alliances.blue.team_keys.includes(TEAM_KEY)) return 'blue';
        return null;
    }

    function matchTime(match) {
        return (match.predicted_time || match.time || 0) * 1000;
    }

    function sortMatches(matches) {
        return matches.slice().sort(function (a, b) {
            var oa = COMP_ORDER[a.comp_level] || 0;
            var ob = COMP_ORDER[b.comp_level] || 0;
            if (oa !== ob) return oa - ob;
            if (a.set_number !== b.set_number) return a.set_number - b.set_number;
            return a.match_number - b.match_number;
        });
    }

    function formatMatchName(match) {
        var level = COMP_LEVELS[match.comp_level] || match.comp_level;
        if (match.comp_level === 'qm') return level + ' ' + match.match_number;
        return level + ' ' + match.set_number + '-' + match.match_number;
    }

    function formatTime(ts) {
        if (!ts) return '';
        var d = new Date(ts * 1000);
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    function teamDisplay(key) {
        return key.replace('frc', '');
    }

    function isEventToday(eventDetails) {
        if (!eventDetails) return false;
        var today = new Date().toISOString().split('T')[0];
        return eventDetails.start_date <= today && eventDetails.end_date >= today;
    }

    function formatEventDate(dateStr) {
        var d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    function findCurrentOrNextEvent(events) {
        var now = new Date();
        var today = now.toISOString().split('T')[0];
        var active = events.filter(function (e) { return e.start_date <= today && e.end_date >= today; });
        if (active.length) return active[0];
        var upcoming = events.filter(function (e) { return e.start_date > today; })
            .sort(function (a, b) { return a.start_date.localeCompare(b.start_date); });
        if (upcoming.length) return upcoming[0];
        var past = events.filter(function (e) { return e.end_date < today; })
            .sort(function (a, b) { return b.end_date.localeCompare(a.end_date); });
        return past.length ? past[0] : null;
    }

    // --- Rendering ---
    function showLoading(show) {
        document.getElementById('frc-loading').style.display = show ? '' : 'none';
    }

    function showError(msg) {
        var el = document.getElementById('frc-error');
        if (msg) {
            el.textContent = msg;
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    }

    function showDashboard() {
        document.getElementById('frc-dashboard').style.display = '';
    }

    function updateTimestamp() {
        document.getElementById('frc-last-updated').textContent =
            'Updated ' + new Date().toLocaleTimeString();
    }

    function renderYearSelector() {
        var sel = document.getElementById('frc-year');
        sel.innerHTML = '';
        for (var y = currentYear; y >= 2020; y--) {
            var opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y + ' Season';
            sel.appendChild(opt);
        }
        sel.value = currentYear;
    }

    function renderEventSelector(events) {
        var sel = document.getElementById('frc-event');
        sel.innerHTML = '<option value="">Select event...</option>';
        events.sort(function (a, b) { return a.start_date.localeCompare(b.start_date); });
        events.forEach(function (ev) {
            var opt = document.createElement('option');
            opt.value = ev.key;
            opt.textContent = ev.name + ' (' + ev.start_date.slice(5) + ')';
            sel.appendChild(opt);
        });
        if (currentEventKey) sel.value = currentEventKey;
    }

    function renderCountdown(matches) {
        var card = document.getElementById('frc-countdown');
        var now = Date.now();
        var upcoming = matches.filter(function (m) {
            return !m.actual_time && matchTime(m) > now;
        });
        upcoming.sort(function (a, b) { return matchTime(a) - matchTime(b); });

        if (!upcoming.length) {
            card.style.display = 'none';
            clearInterval(countdownInterval);
            return;
        }

        var next = upcoming[0];
        var alliance = getTeamAlliance(next);
        document.getElementById('countdown-match').textContent = formatMatchName(next);
        var allianceEl = document.getElementById('countdown-alliance');
        allianceEl.textContent = alliance ? (alliance.charAt(0).toUpperCase() + alliance.slice(1) + ' Alliance') : '';
        allianceEl.className = 'countdown-alliance alliance-' + (alliance || '');

        // Show prediction on countdown
        var predEl = document.getElementById('countdown-prediction');
        var pred = predictions[next.key];
        if (pred && pred.redWinProb != null && alliance) {
            var ourProb = alliance === 'red' ? pred.redWinProb : (1 - pred.redWinProb);
            var pct = Math.round(ourProb * 100);
            predEl.textContent = pct + '% win chance';
            predEl.className = 'countdown-prediction ' + (pct >= 50 ? 'pred-favor' : 'pred-against');
        } else {
            predEl.textContent = '';
        }

        card.style.display = '';

        clearInterval(countdownInterval);
        function tick() {
            var diff = matchTime(next) - Date.now();
            if (diff <= 0) {
                document.getElementById('countdown-timer').textContent = 'Starting now!';
                card.classList.add('urgent');
                clearInterval(countdownInterval);
                return;
            }
            var h = Math.floor(diff / 3600000);
            var m = Math.floor((diff % 3600000) / 60000);
            var s = Math.floor((diff % 60000) / 1000);
            var parts = [];
            if (h > 0) parts.push(h + 'h');
            parts.push(m + 'm');
            parts.push(s + 's');
            document.getElementById('countdown-timer').textContent = parts.join(' ');
            card.classList.toggle('urgent', diff < 300000);
        }
        tick();
        countdownInterval = setInterval(tick, 1000);
    }

    function renderStream(eventDetails) {
        var container = document.getElementById('frc-stream-embed');
        currentEventDetails = eventDetails;
        var tbaLink = 'https://www.thebluealliance.com/event/' + (currentEventKey || '');

        // Check if event is happening today
        if (!isEventToday(eventDetails)) {
            var dateInfo = '';
            if (eventDetails) {
                var today = new Date().toISOString().split('T')[0];
                if (today < eventDetails.start_date) {
                    dateInfo = '<span class="stream-date-info">Event starts ' + formatEventDate(eventDetails.start_date) + '</span>';
                } else {
                    dateInfo = '<span class="stream-date-info">Event ended ' + formatEventDate(eventDetails.end_date) + '</span>';
                }
            }
            container.innerHTML = '<div class="frc-stream-placeholder">' +
                '<span>Stream not active today</span>' +
                dateInfo +
                '<a href="' + tbaLink + '" target="_blank" rel="noopener">View on The Blue Alliance</a>' +
                '</div>';
            return;
        }

        // Event is today — try to embed the webcast
        if (!eventDetails.webcasts || !eventDetails.webcasts.length) {
            container.innerHTML = '<div class="frc-stream-placeholder"><span>No stream link available yet</span><a href="' + tbaLink + '" target="_blank" rel="noopener">View on The Blue Alliance</a></div>';
            return;
        }

        var wc = eventDetails.webcasts[0];
        var src = '';
        if (wc.type === 'twitch') {
            src = 'https://player.twitch.tv/?channel=' + wc.channel + '&parent=vortex1.dev&parent=localhost';
        } else if (wc.type === 'youtube') {
            src = 'https://www.youtube.com/embed/' + wc.channel;
        } else if (wc.type === 'iframe') {
            src = wc.channel;
        }
        if (src) {
            container.innerHTML = '<iframe src="' + src + '" allowfullscreen frameborder="0"></iframe>';
        } else {
            container.innerHTML = '<div class="frc-stream-placeholder"><span>Unsupported stream type</span><a href="' + tbaLink + '" target="_blank" rel="noopener">Watch on The Blue Alliance</a></div>';
        }
    }

    function renderTeamStatus(status) {
        var rankEl = document.getElementById('stat-rank');
        var recordEl = document.getElementById('stat-record');
        var rpEl = document.getElementById('stat-rp');
        var playoffEl = document.getElementById('frc-playoff-status');

        if (!status || !status.qual) {
            rankEl.textContent = '--';
            recordEl.textContent = '--';
            rpEl.textContent = '--';
            playoffEl.textContent = '';
            return;
        }

        var qual = status.qual;
        if (qual.ranking && qual.ranking.rank) {
            rankEl.textContent = '#' + qual.ranking.rank;
        }
        if (qual.ranking && qual.ranking.record) {
            var r = qual.ranking.record;
            recordEl.textContent = r.wins + '-' + r.losses + '-' + r.ties;
        }
        if (qual.ranking && qual.ranking.sort_orders && qual.ranking.sort_orders.length) {
            rpEl.textContent = qual.ranking.sort_orders[0].toFixed(1);
        }

        if (status.alliance) {
            var txt = 'Alliance ' + status.alliance.name;
            if (status.playoff && status.playoff.status) {
                txt += ' | ' + status.playoff.status;
            }
            playoffEl.textContent = txt;
        } else {
            playoffEl.textContent = status.overall_status_str ? stripHtml(status.overall_status_str) : '';
        }
    }

    function stripHtml(html) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    function renderRankings(rankings) {
        var body = document.getElementById('frc-rankings-body');
        if (!rankings || !rankings.rankings || !rankings.rankings.length) {
            body.innerHTML = '<p class="frc-muted">No rankings available</p>';
            return;
        }

        var headers = ['Rank', 'Team', 'Record'];
        if (rankings.sort_order_info && rankings.sort_order_info.length) {
            rankings.sort_order_info.forEach(function (s) { headers.push(s.name); });
        }

        var html = '<table class="frc-rankings-table"><thead><tr>';
        headers.forEach(function (h) { html += '<th>' + h + '</th>'; });
        html += '</tr></thead><tbody>';

        rankings.rankings.forEach(function (r) {
            var isUs = r.team_key === TEAM_KEY;
            html += '<tr class="' + (isUs ? 'our-team' : '') + '">';
            html += '<td>' + r.rank + '</td>';
            html += '<td>' + teamDisplay(r.team_key) + (isUs ? ' *' : '') + '</td>';
            var rec = r.record;
            html += '<td>' + rec.wins + '-' + rec.losses + '-' + rec.ties + '</td>';
            if (r.sort_orders) {
                r.sort_orders.forEach(function (v) {
                    html += '<td>' + (typeof v === 'number' ? v.toFixed(1) : v) + '</td>';
                });
            }
            html += '</tr>';
        });
        html += '</tbody></table>';
        body.innerHTML = html;
    }

    function renderMatches(matches) {
        var body = document.getElementById('frc-matches-body');
        if (!matches || !matches.length) {
            body.innerHTML = '<p class="frc-muted">No matches available</p>';
            return;
        }

        var sorted = sortMatches(matches);
        var now = Date.now();
        var nextFound = false;
        var html = '';

        sorted.forEach(function (m) {
            var alliance = getTeamAlliance(m);
            var played = m.actual_time || (m.alliances.red.score >= 0 && m.alliances.blue.score >= 0 &&
                (m.alliances.red.score > 0 || m.alliances.blue.score > 0));
            var isNext = !played && !nextFound && matchTime(m) > now;
            if (isNext) nextFound = true;

            var resultClass = '';
            if (played && alliance) {
                var won = m.winning_alliance === alliance;
                var tie = m.winning_alliance === '';
                resultClass = won ? 'win' : (tie ? 'tie' : 'loss');
            }

            html += '<div class="frc-match-row ' + (played ? 'played' : '') + ' ' + (isNext ? 'next' : '') + ' ' + resultClass + '">';
            html += '<div class="match-name">' + formatMatchName(m) + '</div>';
            html += '<div class="match-time">' + formatTime(m.predicted_time || m.time) + '</div>';
            html += '<div class="match-alliances">';

            // Red alliance
            html += '<div class="match-alliance red-alliance">';
            m.alliances.red.team_keys.forEach(function (tk) {
                var isOurs = tk === TEAM_KEY;
                html += '<span class="' + (isOurs ? 'team-ours' : '') + '">' + teamDisplay(tk) + '</span>';
            });
            if (played) html += '<span class="match-score">' + m.alliances.red.score + '</span>';
            html += '</div>';

            // Blue alliance
            html += '<div class="match-alliance blue-alliance">';
            m.alliances.blue.team_keys.forEach(function (tk) {
                var isOurs = tk === TEAM_KEY;
                html += '<span class="' + (isOurs ? 'team-ours' : '') + '">' + teamDisplay(tk) + '</span>';
            });
            if (played) html += '<span class="match-score">' + m.alliances.blue.score + '</span>';
            html += '</div>';

            html += '</div>';

            // Prediction badge
            var pred = predictions[m.key];
            if (pred && pred.redWinProb != null && alliance) {
                var ourProb = alliance === 'red' ? pred.redWinProb : (1 - pred.redWinProb);
                var pct = Math.round(ourProb * 100);
                if (played) {
                    // Show if prediction was right or wrong
                    var predCorrect = (pct >= 50 && resultClass === 'win') || (pct < 50 && resultClass === 'loss');
                    html += '<div class="match-pred ' + (predCorrect ? 'pred-correct' : 'pred-wrong') + '">' + pct + '%</div>';
                } else {
                    html += '<div class="match-pred ' + (pct >= 50 ? 'pred-favor' : 'pred-against') + '">' + pct + '%</div>';
                }
            } else {
                html += '<div class="match-pred"></div>';
            }

            html += '</div>';
        });

        body.innerHTML = html;

        // Scroll to next match
        var nextEl = body.querySelector('.frc-match-row.next');
        if (nextEl) nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // --- Data Loading ---
    async function loadEventData(eventKey) {
        if (!eventKey) return;
        currentEventKey = eventKey;

        try {
            var results = await Promise.all([
                fetchMatches(eventKey),
                fetchTeamStatus(eventKey),
                fetchRankings(eventKey),
                fetchEventDetails(eventKey),
                fetchStatboticsMatches(eventKey)
            ]);
            var matches = results[0];
            var status = results[1];
            var rankings = results[2];
            var eventDetails = results[3];
            var statMatches = results[4];

            buildPredictionMap(statMatches);
            renderCountdown(matches);
            renderStream(eventDetails);
            renderTeamStatus(status);
            renderRankings(rankings);
            renderMatches(matches);
            updateTimestamp();
        } catch (err) {
            showError('Failed to load event data: ' + err.message);
        }
    }

    async function loadYear(year) {
        currentYear = year;
        currentEventKey = null;
        showError(null);

        try {
            var events = await fetchEvents(year);
            // Filter to official events (regionals, districts, championships)
            var official = events.filter(function (e) { return e.event_type <= 6; });
            renderEventSelector(official);

            var autoEvent = findCurrentOrNextEvent(official);
            if (autoEvent) {
                currentEventKey = autoEvent.key;
                document.getElementById('frc-event').value = autoEvent.key;
                await loadEventData(autoEvent.key);
            }
        } catch (err) {
            showError('Failed to load events: ' + err.message);
        }
    }

    async function refreshData() {
        if (!currentEventKey) return;
        try {
            var results = await Promise.all([
                fetchMatches(currentEventKey),
                fetchTeamStatus(currentEventKey),
                fetchRankings(currentEventKey),
                fetchStatboticsMatches(currentEventKey)
            ]);
            buildPredictionMap(results[3]);
            renderCountdown(results[0]);
            renderTeamStatus(results[1]);
            renderRankings(results[2]);
            renderMatches(results[0]);
            updateTimestamp();
        } catch (err) {
            // Silent fail on refresh — stale data is fine
        }
    }

    function startAutoRefresh() {
        clearInterval(refreshTimer);
        var interval = REFRESH_ACTIVE;
        refreshTimer = setInterval(refreshData, interval);
    }

    // --- Init ---
    function init() {
        renderYearSelector();
        showLoading(true);

        document.getElementById('frc-year').addEventListener('change', function () {
            loadYear(parseInt(this.value));
        });

        document.getElementById('frc-event').addEventListener('change', function () {
            if (this.value) loadEventData(this.value);
        });

        loadYear(currentYear).then(function () {
            showLoading(false);
            showDashboard();
            startAutoRefresh();
        }).catch(function (err) {
            showLoading(false);
            showError('Failed to initialize: ' + err.message);
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
