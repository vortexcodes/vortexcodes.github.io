(function () {
    const TEAM_KEY = 'frc5940';
    const TEAM_NUM = 5940;
    const TBA_BASE = 'https://www.thebluealliance.com/api/v3';
    const API_KEY = 'AXJEgHS1gv8SBtnQFAZinhvUwgqf9m9gdJZBhwdgNrsumbq2kWrW3YLxwxYIyR5W';
    const REFRESH_ACTIVE = 30000;
    const REFRESH_IDLE = 300000;

    const EVENT_TYPE_OFFSEASON = 99;

    const COMP_LEVELS = { qm: 'Quals', qf: 'Quarters', sf: 'Semis', f: 'Finals' };
    const COMP_ORDER = { qm: 0, qf: 1, sf: 2, f: 3 };

    let currentYear = new Date().getFullYear();
    let currentEventKey = null;
    let currentEventDetails = null;
    let currentMatches = [];
    let predictions = {};
    let predictionSource = null;
    let countdownInterval = null;
    let refreshTimer = null;
    let scheduledNotifications = [];
    const NOTIFY_PREF_KEY = 'frc5940-notify-enabled';
    const NOTIFY_LEAD_KEY = 'frc5940-notify-lead-min';
    const NOTIFY_RESULTS_KEY = 'frc5940-notify-results';
    const DEFAULT_LEAD_MIN = 5;

    // How far ahead of a match the alert fires. Stored per-browser so the
    // choice survives a reload.
    function notifyLeadMin() {
        var stored = parseInt(localStorage.getItem(NOTIFY_LEAD_KEY), 10);
        return isNaN(stored) ? DEFAULT_LEAD_MIN : stored;
    }

    function notifyLeadMs() {
        return notifyLeadMin() * 60 * 1000;
    }

    function leadPhrase() {
        var m = notifyLeadMin();
        return m + ' minute' + (m === 1 ? '' : 's');
    }

    // Place a test match far enough out that the reminder still lands about a
    // minute from now, whatever lead time is selected.
    function testMatchOffsetMs() {
        return notifyLeadMs() + 60 * 1000;
    }
    const MATCH_DURATION_MS = 8 * 60 * 1000;

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

    // --- Win predictions ---
    // Statbotics (api.statbotics.io) was the original source but its v3 API now
    // returns HTTP 500, so predictions come from The Blue Alliance instead:
    //   1. TBA's own match prediction model  -> /event/{key}/predictions
    //   2. OPR-derived estimate as a fallback -> /event/{key}/oprs
    // Both ride the TBA key already used everywhere else, so there is no second
    // provider to keep alive.

    // Spread of alliance scores, in points. Used to turn a predicted score
    // margin into a win probability when we fall back to OPR.
    const OPR_PROB_SCALE = 40;

    // TBA's model is trained on official events and goes haywire on some
    // offseason ones -- at 2026cc it predicted ~640-point alliances (real
    // average is ~119) and called 39 of 70 quals at over 99% confidence.
    // A field where the median match is a near-certainty is not a real field,
    // so treat that as "no model" rather than showing bogus percentages.
    const DEGENERATE_PROB_MEDIAN = 0.95;

    function median(nums) {
        if (!nums.length) return null;
        var sorted = nums.slice().sort(function (a, b) { return a - b; });
        var mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    async function fetchPredictions(eventKey) {
        try {
            return await tbaFetch('/event/' + eventKey + '/predictions');
        } catch (e) {
            return null;
        }
    }

    async function fetchOprs(eventKey) {
        try {
            return await tbaFetch('/event/' + eventKey + '/oprs');
        } catch (e) {
            return null;
        }
    }

    function buildPredictionMap(predData, oprData, matches) {
        predictions = {};
        predictionSource = null;

        // --- Preferred: TBA's match prediction model ---
        var mp = predData && predData.match_predictions;
        if (mp) {
            var modelled = {};
            var winnerProbs = [];
            ['qual', 'playoff'].forEach(function (level) {
                var bucket = mp[level];
                if (!bucket) return;
                Object.keys(bucket).forEach(function (key) {
                    var p = bucket[key];
                    if (!p || p.prob == null || !isFinite(p.prob)) return;
                    // TBA reports the probability that `winning_alliance` wins,
                    // not the probability that red wins.
                    var redWinProb = p.winning_alliance === 'red' ? p.prob : 1 - p.prob;
                    modelled[key] = {
                        redWinProb: redWinProb,
                        redScore: p.red ? p.red.score : null,
                        blueScore: p.blue ? p.blue.score : null
                    };
                    winnerProbs.push(Math.max(p.prob, 1 - p.prob));
                });
            });

            var med = median(winnerProbs);
            var degenerate = winnerProbs.length >= 5 && med != null && med >= DEGENERATE_PROB_MEDIAN;
            if (Object.keys(modelled).length && !degenerate) {
                predictions = modelled;
                predictionSource = 'tba';
                return;
            }
        }

        // --- Fallback: estimate from OPR (offense power rating) ---
        var oprs = oprData && oprData.oprs;
        if (!oprs || !Array.isArray(matches)) return;

        // Before any match is played TBA reports every OPR as 0, which would
        // make every match a coin flip. Treat that as "no data" instead.
        var anyOpr = Object.keys(oprs).some(function (k) { return oprs[k]; });
        if (!anyOpr) return;

        function allianceScore(teamKeys) {
            return teamKeys.reduce(function (sum, tk) { return sum + (oprs[tk] || 0); }, 0);
        }

        matches.forEach(function (m) {
            if (!m.alliances) return;
            var red = allianceScore(m.alliances.red.team_keys);
            var blue = allianceScore(m.alliances.blue.team_keys);
            predictions[m.key] = {
                redWinProb: 1 / (1 + Math.exp(-(red - blue) / OPR_PROB_SCALE)),
                redScore: red,
                blueScore: blue
            };
        });
        if (Object.keys(predictions).length) predictionSource = 'opr';
    }

    function predictionSourceLabel() {
        if (predictionSource === 'tba') return 'Predictions: The Blue Alliance model';
        if (predictionSource === 'opr') return 'Predictions: OPR estimate from this event';
        return 'Predictions unavailable until matches are played';
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

    // A match counts as played once TBA posts a result. Ties leave
    // winning_alliance as an empty string, so that field alone is not enough.
    function isPlayed(match) {
        if (!match || !match.alliances) return false;
        return !!(match.actual_time || (match.alliances.red.score >= 0 && match.alliances.blue.score >= 0 &&
            (match.alliances.red.score > 0 || match.alliances.blue.score > 0)));
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
            var suffix = ev.event_type === EVENT_TYPE_OFFSEASON ? ' \u2014 Offseason' : '';
            opt.textContent = ev.name + ' (' + ev.start_date.slice(5) + ')' + suffix;
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
            var played = isPlayed(m);
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

        var srcEl = document.getElementById('frc-pred-source');
        if (srcEl) srcEl.textContent = predictionSourceLabel();

        // Scroll to next match
        var nextEl = body.querySelector('.frc-match-row.next');
        if (nextEl) nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // --- Calendar & Notifications ---
    function getStreamUrl(eventDetails) {
        if (!eventDetails || !eventDetails.webcasts || !eventDetails.webcasts.length) return null;
        var yt = eventDetails.webcasts.filter(function (w) { return w.type === 'youtube'; })[0];
        if (yt) return 'https://www.youtube.com/watch?v=' + yt.channel;
        var tw = eventDetails.webcasts.filter(function (w) { return w.type === 'twitch'; })[0];
        if (tw) return 'https://www.twitch.tv/' + tw.channel;
        var iframe = eventDetails.webcasts.filter(function (w) { return w.type === 'iframe'; })[0];
        if (iframe) return iframe.channel;
        return null;
    }

    function getViewerUrl() {
        return window.location.origin + window.location.pathname;
    }

    function upcomingMatches(matches) {
        var now = Date.now();
        return matches.filter(function (m) {
            return !m.actual_time && matchTime(m) > now;
        }).sort(function (a, b) { return matchTime(a) - matchTime(b); });
    }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    function icsDate(ms) {
        var d = new Date(ms);
        return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + 'T' +
            pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + 'Z';
    }

    function escapeIcs(s) {
        return String(s == null ? '' : s)
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\r?\n/g, '\\n');
    }

    function buildIcs(matches, eventDetails, includePast) {
        var streamUrl = getStreamUrl(eventDetails);
        var viewerUrl = getViewerUrl();
        var stamp = icsDate(Date.now());
        var locationStr = '';
        if (eventDetails) {
            var parts = [];
            if (eventDetails.name) parts.push(eventDetails.name);
            if (eventDetails.city) parts.push(eventDetails.city);
            if (eventDetails.state_prov) parts.push(eventDetails.state_prov);
            if (eventDetails.country) parts.push(eventDetails.country);
            locationStr = parts.join(', ');
        }
        var calName = 'FRC 5940 - ' + (eventDetails && eventDetails.name ? eventDetails.name : 'Matches');
        var lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Vortex1//FRC 5940 BREAD//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:' + escapeIcs(calName)
        ];
        var iterMatches;
        if (includePast) {
            iterMatches = matches.slice()
                .filter(function (m) { return matchTime(m) > 0; })
                .sort(function (a, b) { return matchTime(a) - matchTime(b); });
        } else {
            iterMatches = upcomingMatches(matches);
        }
        iterMatches.forEach(function (m) {
            var startMs = matchTime(m);
            var endMs = startMs + MATCH_DURATION_MS;
            var name = formatMatchName(m);
            var alliance = getTeamAlliance(m);
            var summary = 'FRC 5940 - ' + name;
            var descLines = ['FRC 5940 BREAD' + (alliance ? ' on ' + alliance.toUpperCase() + ' alliance' : '') + '.'];
            if (streamUrl) descLines.push('Watch live: ' + streamUrl);
            descLines.push('Dashboard: ' + viewerUrl);
            lines.push('BEGIN:VEVENT');
            lines.push('UID:' + m.key + '@vortex1.dev');
            lines.push('DTSTAMP:' + stamp);
            lines.push('DTSTART:' + icsDate(startMs));
            lines.push('DTEND:' + icsDate(endMs));
            lines.push('SUMMARY:' + escapeIcs(summary));
            lines.push('DESCRIPTION:' + escapeIcs(descLines.join('\n')));
            if (locationStr) lines.push('LOCATION:' + escapeIcs(locationStr));
            if (streamUrl) lines.push('URL:' + streamUrl);
            lines.push('BEGIN:VALARM');
            lines.push('TRIGGER:-PT' + notifyLeadMin() + 'M');
            lines.push('ACTION:DISPLAY');
            lines.push('DESCRIPTION:' + escapeIcs('FRC 5940 plays in ' + leadPhrase() + ' - ' + name));
            lines.push('END:VALARM');
            lines.push('END:VEVENT');
        });
        lines.push('END:VCALENDAR');
        return lines.join('\r\n');
    }

    function downloadCalendar() {
        var upcoming = upcomingMatches(currentMatches);
        var matches = upcoming.length ? upcoming : currentMatches.slice().sort(function (a, b) { return matchTime(a) - matchTime(b); });
        if (!matches.length) {
            setReminderStatus('No matches available to export.');
            return;
        }
        var includePast = upcoming.length === 0;
        var ics = buildIcs(matches, currentEventDetails, includePast);
        var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'frc5940-' + (currentEventKey || 'matches') + '.ics';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        var label = includePast ? 'past match' : 'upcoming match';
        setReminderStatus('Calendar downloaded — ' + matches.length + ' ' + label + (matches.length === 1 ? '' : 'es') + ' with 5-minute alarms.');
    }

    async function sendTestNotification() {
        if (!('Notification' in window)) {
            setReminderStatus('This browser does not support notifications.');
            return;
        }
        var perm = Notification.permission;
        if (perm === 'default') {
            perm = await Notification.requestPermission();
        }
        if (perm !== 'granted') {
            setReminderStatus('Notification permission denied. Enable it in your browser site settings to test alerts.');
            return;
        }
        var sample = pickSampleMatch();
        var streamUrl = getStreamUrl(currentEventDetails);
        var viewerUrl = getViewerUrl();
        var name = sample ? formatMatchName(sample) : 'Sample Match';
        var alliance = sample ? getTeamAlliance(sample) : null;
        var bodyParts = ['[TEST] BREAD plays in ' + leadPhrase() + (alliance ? ' on ' + alliance.toUpperCase() + ' alliance' : '') + '.'];
        if (streamUrl) bodyParts.push('Watch: ' + streamUrl);
        bodyParts.push('Dashboard: ' + viewerUrl);
        var notif = new Notification('FRC 5940 - ' + name + ' (Test)', {
            body: bodyParts.join('\n'),
            icon: 'media/favicon.png',
            tag: 'frc5940-test',
            requireInteraction: true
        });
        notif.onclick = function () {
            window.focus();
            if (streamUrl) window.open(streamUrl, '_blank', 'noopener');
            notif.close();
        };
        setReminderStatus('Test notification sent. If you do not see it, check your OS notification settings (Do Not Disturb, Focus mode).');
    }

    function googleCalendarUrl(match, eventDetails) {
        var matchStartMs = matchTime(match);
        var startMs = matchStartMs - notifyLeadMs();
        var endMs = matchStartMs + MATCH_DURATION_MS;
        var name = formatMatchName(match);
        var alliance = getTeamAlliance(match);
        var streamUrl = getStreamUrl(eventDetails);
        var viewerUrl = getViewerUrl();
        var detailLines = [
            'FRC 5940 BREAD' + (alliance ? ' on ' + alliance.toUpperCase() + ' alliance' : '') + '.',
            'Match starts at ' + formatTime(matchStartMs / 1000) + ' \u2014 this event is set ' + leadPhrase() + ' early as your heads-up.'
        ];
        if (streamUrl) detailLines.push('Watch live: ' + streamUrl);
        detailLines.push('Dashboard: ' + viewerUrl);
        var locParts = [];
        if (eventDetails) {
            if (eventDetails.name) locParts.push(eventDetails.name);
            if (eventDetails.city) locParts.push(eventDetails.city);
            if (eventDetails.state_prov) locParts.push(eventDetails.state_prov);
            if (eventDetails.country) locParts.push(eventDetails.country);
        }
        var params = new URLSearchParams({
            action: 'TEMPLATE',
            text: 'FRC 5940 - ' + name + ' (5 min warning)',
            dates: icsDate(startMs) + '/' + icsDate(endMs),
            details: detailLines.join('\n'),
            location: locParts.join(', ')
        });
        return 'https://calendar.google.com/calendar/render?' + params.toString();
    }

    function openGoogleCalendar() {
        var match = pickSampleMatch();
        if (!match) {
            setReminderStatus('No match available to add.');
            return;
        }
        var url = googleCalendarUrl(match, currentEventDetails);
        window.open(url, '_blank', 'noopener');
        var upcoming = upcomingMatches(currentMatches);
        var label = upcoming.length ? 'next match' : 'most recent match';
        setReminderStatus('Opened Google Calendar for the ' + label + ' (' + formatMatchName(match) + '). Event is scheduled ' + leadPhrase() + ' before kickoff so it doubles as your reminder.');
    }

    function addAllToGoogleCalendar() {
        var upcoming = upcomingMatches(currentMatches);
        var matches = upcoming.length ? upcoming : currentMatches.slice().sort(function (a, b) { return matchTime(a) - matchTime(b); });
        if (!matches.length) {
            setReminderStatus('No matches available to add.');
            return;
        }
        downloadCalendar();
        window.open('https://calendar.google.com/calendar/u/0/r/settings/export', '_blank', 'noopener');
        setReminderStatus('Downloaded ' + matches.length + ' match' + (matches.length === 1 ? '' : 'es') + ' and opened Google Calendar. Scroll to "Import" in the new tab and select the .ics file — the 5-minute alarms will carry through.');
    }

    function openTestGoogleCalendar() {
        var sample = pickSampleMatch();
        var streamUrl = getStreamUrl(currentEventDetails);
        var viewerUrl = getViewerUrl();
        var name = sample ? formatMatchName(sample) : 'Sample Match';
        var alliance = sample ? getTeamAlliance(sample) : null;
        var now = Date.now();
        var matchStartMs = now + testMatchOffsetMs();
        var startMs = matchStartMs - notifyLeadMs();
        var endMs = matchStartMs + MATCH_DURATION_MS;
        var detailLines = [
            '[TEST] FRC 5940 BREAD' + (alliance ? ' on ' + alliance.toUpperCase() + ' alliance' : '') + '. This event is for testing — ignore the time.'
        ];
        if (streamUrl) detailLines.push('Watch live: ' + streamUrl);
        detailLines.push('Dashboard: ' + viewerUrl);
        var locParts = [];
        if (currentEventDetails) {
            if (currentEventDetails.name) locParts.push(currentEventDetails.name);
            if (currentEventDetails.city) locParts.push(currentEventDetails.city);
            if (currentEventDetails.state_prov) locParts.push(currentEventDetails.state_prov);
            if (currentEventDetails.country) locParts.push(currentEventDetails.country);
        }
        var params = new URLSearchParams({
            action: 'TEMPLATE',
            text: '[TEST] FRC 5940 - ' + name + ' (5 min warning)',
            dates: icsDate(startMs) + '/' + icsDate(endMs),
            details: detailLines.join('\n'),
            location: locParts.join(', ')
        });
        window.open('https://calendar.google.com/calendar/render?' + params.toString(), '_blank', 'noopener');
        setReminderStatus('Opened Google Calendar with a test event. Save it — the entry will appear on your calendar in about 1 minute.');
    }

    function downloadTestCalendar() {
        var sample = pickSampleMatch();
        var streamUrl = getStreamUrl(currentEventDetails);
        var viewerUrl = getViewerUrl();
        var name = sample ? formatMatchName(sample) : 'Sample Match';
        var alliance = sample ? getTeamAlliance(sample) : null;
        var now = Date.now();
        var startMs = now + testMatchOffsetMs();
        var endMs = startMs + MATCH_DURATION_MS;
        var descLines = ['[TEST] FRC 5940 BREAD' + (alliance ? ' on ' + alliance.toUpperCase() + ' alliance' : '') + '. This event is for testing — ignore the time.'];
        if (streamUrl) descLines.push('Watch live: ' + streamUrl);
        descLines.push('Dashboard: ' + viewerUrl);
        var lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Vortex1//FRC 5940 BREAD//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:' + escapeIcs('FRC 5940 - Calendar Test'),
            'BEGIN:VEVENT',
            'UID:test-' + now + '@vortex1.dev',
            'DTSTAMP:' + icsDate(now),
            'DTSTART:' + icsDate(startMs),
            'DTEND:' + icsDate(endMs),
            'SUMMARY:' + escapeIcs('[TEST] FRC 5940 - ' + name),
            'DESCRIPTION:' + escapeIcs(descLines.join('\n'))
        ];
        if (streamUrl) lines.push('URL:' + streamUrl);
        lines.push(
            'BEGIN:VALARM',
            'TRIGGER:-PT' + notifyLeadMin() + 'M',
            'ACTION:DISPLAY',
            'DESCRIPTION:' + escapeIcs('[TEST] FRC 5940 plays in ' + leadPhrase() + ' - ' + name),
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR'
        );
        var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'frc5940-calendar-test.ics';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        setReminderStatus('Test calendar event downloaded. Import it now — the 5-minute alarm should fire in about 1 minute.');
    }

    function pickSampleMatch() {
        if (!currentMatches.length) return null;
        var upcoming = upcomingMatches(currentMatches);
        if (upcoming.length) return upcoming[0];
        var sorted = currentMatches.slice().sort(function (a, b) { return matchTime(b) - matchTime(a); });
        return sorted[0];
    }

    function clearScheduledNotifications() {
        scheduledNotifications.forEach(function (id) { clearTimeout(id); });
        scheduledNotifications = [];
    }

    function scheduleMatchNotifications() {
        clearScheduledNotifications();
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if (localStorage.getItem(NOTIFY_PREF_KEY) !== '1') return;
        var streamUrl = getStreamUrl(currentEventDetails);
        var viewerUrl = getViewerUrl();
        var now = Date.now();
        var scheduled = 0;
        upcomingMatches(currentMatches).forEach(function (m) {
            var fireAt = matchTime(m) - notifyLeadMs();
            var delay = fireAt - now;
            if (delay <= 0 || delay > 2147483000) return;
            var name = formatMatchName(m);
            var alliance = getTeamAlliance(m);
            var id = setTimeout(function () {
                var lead = notifyLeadMin();
                var bodyParts = ['BREAD plays in ' + lead + ' minute' + (lead === 1 ? '' : 's') +
                    (alliance ? ' on ' + alliance.toUpperCase() + ' alliance' : '') + '.'];
                if (streamUrl) bodyParts.push('Watch: ' + streamUrl);
                bodyParts.push('Dashboard: ' + viewerUrl);
                var notif = new Notification('FRC 5940 - ' + name, {
                    body: bodyParts.join('\n'),
                    icon: 'media/favicon.png',
                    tag: 'frc5940-' + m.key,
                    requireInteraction: true
                });
                notif.onclick = function () {
                    window.focus();
                    if (streamUrl) window.open(streamUrl, '_blank', 'noopener');
                    notif.close();
                };
            }, delay);
            scheduledNotifications.push(id);
            scheduled++;
        });
        updateReminderUi(scheduled);
    }

    // Fire a notification when one of BREAD's matches gets a score posted.
    // Compares the previous poll against the fresh one so each result alerts once.
    function notifyNewResults(previousMatches, freshMatches) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if (localStorage.getItem(NOTIFY_PREF_KEY) !== '1') return;
        if (localStorage.getItem(NOTIFY_RESULTS_KEY) === '0') return;
        if (!Array.isArray(previousMatches) || !previousMatches.length) return;

        var wasPlayed = {};
        previousMatches.forEach(function (m) {
            wasPlayed[m.key] = isPlayed(m);
        });

        freshMatches.forEach(function (m) {
            // Only announce a transition from "no result" to "result".
            if (!isPlayed(m) || wasPlayed[m.key] !== false) return;

            var alliance = getTeamAlliance(m);
            if (!alliance) return;
            var ours = m.alliances[alliance].score;
            var theirs = m.alliances[alliance === 'red' ? 'blue' : 'red'].score;
            var name = formatMatchName(m);
            var outcome = ours > theirs ? ' \u2014 WIN' : (ours < theirs ? ' \u2014 Loss' : ' \u2014 Tie');

            var notif = new Notification('FRC 5940 - ' + name + outcome, {
                body: 'Final: ' + ours + ' \u2013 ' + theirs + ' (BREAD on ' + alliance.toUpperCase() + ').',
                icon: 'media/favicon.png',
                tag: 'frc5940-result-' + m.key
            });
            notif.onclick = function () {
                window.focus();
                notif.close();
            };
        });
    }

    function setReminderStatus(msg) {
        var el = document.getElementById('frc-reminders-status');
        if (el) el.textContent = msg || '';
    }

    function updateReminderUi(scheduledCount) {
        var card = document.getElementById('frc-reminders');
        if (!card) return;
        card.style.display = '';
        var count = upcomingMatches(currentMatches).length;
        var countEl = document.getElementById('frc-reminders-count');
        if (countEl) {
            countEl.textContent = count ? (count + ' upcoming match' + (count === 1 ? '' : 'es')) : 'No upcoming matches';
        }
        var btn = document.getElementById('frc-btn-notify');
        if (btn) {
            if (!('Notification' in window)) {
                btn.textContent = 'Notifications unsupported';
                btn.disabled = true;
            } else if (Notification.permission === 'denied') {
                btn.textContent = 'Notifications blocked';
                btn.disabled = true;
            } else if (Notification.permission === 'granted' && localStorage.getItem(NOTIFY_PREF_KEY) === '1') {
                btn.textContent = 'Notifications On — Disable';
                btn.disabled = false;
                btn.classList.add('active');
            } else {
                btn.textContent = 'Enable Notifications';
                btn.disabled = false;
                btn.classList.remove('active');
            }
        }
        if (scheduledCount != null && scheduledCount > 0) {
            setReminderStatus(scheduledCount + ' alert' + (scheduledCount === 1 ? '' : 's') + ' scheduled. Keep this tab open to receive them.');
        }
    }

    async function toggleNotifications() {
        if (!('Notification' in window)) return;
        if (localStorage.getItem(NOTIFY_PREF_KEY) === '1' && Notification.permission === 'granted') {
            localStorage.removeItem(NOTIFY_PREF_KEY);
            clearScheduledNotifications();
            setReminderStatus('Notifications disabled.');
            updateReminderUi(0);
            return;
        }
        var perm = Notification.permission;
        if (perm === 'default') {
            perm = await Notification.requestPermission();
        }
        if (perm !== 'granted') {
            setReminderStatus('Notification permission denied. Enable it in your browser site settings to receive match alerts.');
            updateReminderUi(0);
            return;
        }
        localStorage.setItem(NOTIFY_PREF_KEY, '1');
        scheduleMatchNotifications();
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
                fetchPredictions(eventKey),
                fetchOprs(eventKey)
            ]);
            var matches = results[0];
            var status = results[1];
            var rankings = results[2];
            var eventDetails = results[3];

            currentMatches = matches || [];
            currentEventDetails = eventDetails;
            buildPredictionMap(results[4], results[5], currentMatches);
            renderCountdown(matches);
            renderStream(eventDetails);
            renderTeamStatus(status);
            renderRankings(rankings);
            renderMatches(matches);
            scheduleMatchNotifications();
            updateReminderUi();
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
            // Keep official events (regionals, districts, championships) *and*
            // offseason events — Chezy Champs, Madtown Throwdown and friends are
            // event_type 99 and were previously filtered out entirely.
            var shown = events.filter(function (e) {
                return e.event_type <= 6 || e.event_type === EVENT_TYPE_OFFSEASON;
            });
            renderEventSelector(shown);

            var autoEvent = findCurrentOrNextEvent(shown);
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
                fetchPredictions(currentEventKey),
                fetchOprs(currentEventKey)
            ]);
            var previousMatches = currentMatches;
            currentMatches = results[0] || [];
            buildPredictionMap(results[3], results[4], currentMatches);
            notifyNewResults(previousMatches, currentMatches);
            renderCountdown(results[0]);
            renderTeamStatus(results[1]);
            renderRankings(results[2]);
            renderMatches(results[0]);
            scheduleMatchNotifications();
            updateReminderUi();
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

        document.getElementById('frc-btn-calendar').addEventListener('click', downloadCalendar);
        document.getElementById('frc-btn-google').addEventListener('click', openGoogleCalendar);
        document.getElementById('frc-btn-google-all').addEventListener('click', addAllToGoogleCalendar);
        document.getElementById('frc-btn-notify').addEventListener('click', toggleNotifications);
        document.getElementById('frc-btn-test').addEventListener('click', sendTestNotification);
        document.getElementById('frc-btn-test-cal').addEventListener('click', downloadTestCalendar);
        document.getElementById('frc-btn-test-google').addEventListener('click', openTestGoogleCalendar);

        var leadSel = document.getElementById('frc-notify-lead');
        if (leadSel) {
            leadSel.value = String(notifyLeadMin());
            leadSel.addEventListener('change', function () {
                localStorage.setItem(NOTIFY_LEAD_KEY, this.value);
                // Re-arm the pending timers against the new lead time.
                scheduleMatchNotifications();
                setReminderStatus('Alerts now fire ' + this.value + ' minutes before each match.');
            });
        }

        var resultsToggle = document.getElementById('frc-notify-results');
        if (resultsToggle) {
            resultsToggle.checked = localStorage.getItem(NOTIFY_RESULTS_KEY) !== '0';
            resultsToggle.addEventListener('change', function () {
                localStorage.setItem(NOTIFY_RESULTS_KEY, this.checked ? '1' : '0');
                setReminderStatus(this.checked
                    ? 'Score alerts on: you will get a notification when each BREAD match is scored.'
                    : 'Score alerts off.');
            });
        }

        // Browsers throttle (and sometimes drop) timers in background tabs.
        // Re-arm on the way back so a long-pending alert is not lost.
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && currentEventKey) {
                scheduleMatchNotifications();
                refreshData();
            }
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
