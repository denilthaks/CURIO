"""One-off content migration: inserts theory cards (lesson scenes) into the
existing quests and labels challenge phases. Idempotent: re-running it skips
lessons that are already present. Kept in the repo as a record of the change.

Usage: python3 tools/add-lessons.py
"""
import json
from pathlib import Path

QUESTS = Path(__file__).resolve().parent.parent / "public" / "data" / "quests"
ACTION = "Start the guided exercise"


def lesson(id, title, speaker, skills, **content):
    return {"id": id, "type": "lesson", "title": title, "speaker": speaker, "skills": skills, "action": ACTION, "lesson": content}


LESSONS = {
    "missing-signal": [
        ("find-source", lesson(
            "lesson-sources", "Learn: sources and summaries", "mira", ["distinguish-source", "verify-claims"],
            concept="Sources and summaries",
            objective="Tell where information comes from, and check copies against the original.",
            plainEnglish="An original source is where a piece of information starts: the person or organisation responsible for it. A summary, whether written by a person or by an AI, is a retelling. Retellings can drop, change or invent details, so when details matter you compare the summary with the source.",
            analogy="Think of a recipe passed along by word of mouth. By the third retelling, “a teaspoon of salt” can become “a tablespoon”. The cookbook is the source; the retellings are summaries.",
            example={"kind": "text", "code": "Train company website:  \"Last train 23:10\"            ← source\nFriend's text:          \"last train's around 11:30?\"   ← retelling\nAI answer:              \"The last train leaves at 23:40.\" ← retelling (sounds sure)", "caption": "Which one would you trust to catch the last train?"},
            whyItMatters="AI tools write fluent, confident text even when a detail is wrong. Checking important facts against the source protects you and everyone you share them with.",
            commonMistake="Treating a confident tone, or hearing the same claim twice, as proof. If two retellings come from the same mistaken copy, they are one claim, not two.",
            takeaway="Find the source, compare the details, and trust the source when they disagree.",
        )),
        ("better-prompt", lesson(
            "lesson-prompts", "Learn: writing a useful prompt", "mira", ["prompt-context"],
            concept="Writing a useful prompt",
            objective="Give an AI assistant the information and limits it needs.",
            plainEnglish="A prompt is the instruction you give an AI assistant. It only knows what you tell it and what it learned in training, so a vague prompt gets a vague or invented answer. Useful prompts usually include the goal, the audience, the source material, the format, and what to do when information is missing.",
            analogy="Briefing a new temp. “Sort out the bakery email” could produce anything. “Using this price list, write a three-line email to regular customers about Saturday’s hours, and don’t promise discounts” gets you what you need.",
            example={"kind": "text", "code": "Weak:    Write about our bakery's new hours.\n\nStronger: Using the opening hours below, write a 50-word notice for\n          regular customers in a friendly tone. Don't mention prices.\n          If a day isn't listed, say \"closed\" rather than guessing.\n          [opening hours pasted here]"},
            whyItMatters="Clear prompts reduce invented details and save rounds of editing. A good prompt doesn’t make the output true, though. You still check it.",
            commonMistake="Asking for “something exciting” or telling the assistant to “fix any mistakes” without giving it the facts. It can’t check facts it was never given.",
            takeaway="Goal + audience + source + format + “don’t guess”. Then check the result.",
        )),
    ],
    "the-ledger": [
        ("filter-north", lesson(
            "lesson-where", "Learn: filtering rows with WHERE", "mira", ["filter-rows"],
            concept="Filtering rows with WHERE",
            objective="Keep only the rows that match a condition.",
            plainEnglish="A table can hold thousands of rows. WHERE tells the database which rows to keep, using a condition such as city = 'Leeds' or price > 10. Text values go in single quotes and must match the data exactly; numbers don’t need quotes.",
            analogy="A librarian fetching only the books from one shelf, instead of carrying out the whole library.",
            example={"kind": "sql", "code": "SELECT customer_name, city\nFROM customers\nWHERE city = 'Leeds';", "caption": "Returns only customers whose city is exactly Leeds."},
            whyItMatters="Most business questions are about a slice of the data: one region, one month, one product. WHERE is how you ask for that slice.",
            commonMistake="Forgetting the quotes around text, or changing its capitalisation. In many databases 'leeds' won’t match 'Leeds'.",
            takeaway="SELECT picks the columns; WHERE picks the rows.",
        )),
        ("group-products", lesson(
            "lesson-group-by", "Learn: grouping data", "mira", ["group-aggregate"],
            concept="Grouping data",
            objective="Calculate one result for each group of rows.",
            plainEnglish="GROUP BY combines rows that share the same value, so you can calculate a result for each group. You pair it with an aggregate function: SUM adds up, COUNT counts rows and AVG finds the average.",
            analogy="A coffee shop manager wants total sales for each drink, rather than one total for every product combined.",
            example={"kind": "sql", "code": "SELECT product_name, SUM(sales) AS total_sales\nFROM transactions\nGROUP BY product_name;", "caption": "One row per drink, each with its own total."},
            whyItMatters="Summaries by group, such as sales per region or orders per customer, are the backbone of reports and dashboards.",
            commonMistake="Selecting a column that isn’t aggregated and isn’t in the GROUP BY. If you group by product_name but also select order_date, the database can’t know which of the many dates to show for each product.",
            takeaway="GROUP BY makes the groups; SUM, COUNT and AVG calculate one value per group.",
        )),
        ("top-product", lesson(
            "lesson-order-limit", "Learn: sorting and finding the top", "mira", ["rank-results"],
            concept="Sorting and finding the top result",
            objective="Rank results and keep only the first few.",
            plainEnglish="ORDER BY sorts the results: ASC puts the smallest first (the default) and DESC puts the largest first. LIMIT keeps only the first few rows. Together they answer “what’s the top…?” questions.",
            analogy="Sorting a league table by points, then reading only the team at the top.",
            example={"kind": "sql", "code": "SELECT customer_name, SUM(amount) AS spent\nFROM orders\nGROUP BY customer_name\nORDER BY spent DESC\nLIMIT 3;", "caption": "The three customers who spent the most."},
            whyItMatters="Rankings such as best sellers, biggest customers and slowest deliveries are among the most common questions in business.",
            commonMistake="Forgetting DESC, which gives the smallest values first, or using LIMIT without ORDER BY, which returns rows in no guaranteed order.",
            takeaway="ORDER BY … DESC, then LIMIT, gives you the top results.",
        )),
    ],
    "broken-tally": [
        ("read-error", lesson(
            "lesson-errors-types", "Learn: reading errors and data types", "sigrun", ["read-errors", "fix-types"],
            concept="Reading errors and data types",
            objective="Use an error message and a value’s type to find a bug.",
            plainEnglish="Every value in Python has a type: whole numbers are int, decimals are float, text is str, and lists hold several values. Some operations only work between compatible types. + can add two numbers or join two pieces of text, but it can’t mix a number with text. When something goes wrong, Python stops and prints a traceback; its last line names the error and explains it.",
            analogy="A vending machine that takes coins or a card, but not a coin taped to a card. It stops and shows a message saying what it can’t accept.",
            example={"kind": "python", "code": "age = 30\nprint(\"Age: \" + age)        # TypeError: can only concatenate str (not \"int\") to str\nprint(\"Age: \" + str(age))   # Age: 30", "caption": "str() turns a number into text so it can be joined to other text."},
            whyItMatters="Reading the error turns a scary crash into a clue. Many beginner bugs are type mix-ups like this one.",
            commonMistake="Reading the traceback from the top and panicking. Start with the last line: it says what went wrong and usually why.",
            takeaway="Read the last line of the error, then check the types of the values involved.",
        )),
        ("average", lesson(
            "lesson-expressions", "Learn: calculating from variables", "sigrun", ["write-expressions"],
            concept="Calculating from variables",
            objective="Write expressions that work from the data, not typed-in answers.",
            plainEnglish="An expression is code that produces a value, like price * 2 or len(names). Variables are names for values. Writing calculations with variables, instead of typing the numbers, means the program still works when the data changes. Handy built-ins: sum() adds a list, len() counts its items, max() and min() find the largest and smallest, and round(x, n) rounds.",
            analogy="A spreadsheet formula versus a sticky note. The formula updates when the numbers change; the sticky note is wrong the moment they do.",
            example={"kind": "python", "code": "temperatures = [18, 21, 19, 22]\nwarmest = max(temperatures)     # 22\ndays = len(temperatures)        # 4\nspread = warmest - min(temperatures)   # 4", "caption": "Each result is calculated, so it stays right if the list changes."},
            whyItMatters="Hard-coded numbers are a common source of bugs in real reports: the data changes and the typed number doesn’t.",
            commonMistake="Typing in an answer worked out by hand, or dividing by a count you typed instead of calculating it with len().",
            takeaway="Calculate from variables with operators and built-ins; don’t type answers in.",
        )),
    ],
    "market-ledger": [
        ("find-cell", lesson(
            "lesson-cells-formulas", "Learn: cells, formulas and filling down", "tove", ["read-cells", "write-formulas"],
            concept="Cells, formulas and filling down",
            objective="Find cells by address and write a formula once for a whole column.",
            plainEnglish="Every cell has an address: its column letter, then its row number, like C4. A formula starts with = and can refer to other cells, such as =C4*D4. When you copy a formula down a column with the fill handle, Excel shifts the row numbers for you, so =C4*D4 becomes =C5*D5 on the next row.",
            analogy="Grid references on a map: “column C, row 4” finds exactly one square.",
            example={"kind": "excel", "code": "     A         B       C        D\n1  Room      Floor   Length   Width\n2  Kitchen   1       4        3       E2: =C2*D2  → 12\n3  Hall      1       6        2       E3: =C3*D3  → 12 (filled down)", "caption": "Each room’s area: one formula, filled down."},
            whyItMatters="Formulas that refer to cells update automatically when the data changes, and one formula can serve a whole column.",
            commonMistake="Typing the result (12) instead of a formula, or forgetting the = so Excel treats the entry as text.",
            takeaway="Start with =, refer to cells, and fill down.",
        )),
        ("total", lesson(
            "lesson-ranges", "Learn: ranges and functions", "tove", ["use-ranges"],
            concept="Ranges and functions",
            objective="Use functions such as SUM and AVERAGE on a block of cells.",
            plainEnglish="A range is a block of cells written first:last, like E2:E9. Functions take ranges and return one result: SUM adds them, AVERAGE finds the mean, MIN and MAX find the smallest and largest, and COUNT counts the numbers.",
            analogy="Pointing at a pile of receipts and saying “add these up”, instead of reading each one out loud.",
            example={"kind": "excel", "code": "=SUM(E2:E9)       total of E2 to E9\n=MAX(B2:B20)      largest value in B2 to B20\n=AVERAGE(C2:C5)   mean of four cells", "caption": "Function name, then the range in brackets."},
            whyItMatters="Ranges keep formulas short, readable and correct when values change. Adding cells one by one is slow and easy to get wrong.",
            commonMistake="Choosing the wrong range, for example including a header or an existing total row, which counts it twice.",
            takeaway="=FUNCTION(first:last), and check the range covers exactly the cells you mean.",
        )),
    ],
    "great-hall-dashboard": [
        ("sort-kpis", lesson(
            "lesson-dashboards", "Learn: grouping KPIs on a dashboard", "astrid", ["categorise-kpis"],
            concept="Grouping KPIs on a dashboard",
            objective="Group measures by the business question they answer.",
            plainEnglish="A dashboard shows a few key measures (KPIs) at a glance. It is easier to read when KPIs are grouped by the question they answer. Three common groups are revenue (money coming in, and whether it’s growing), profitability (what’s left after costs), and customer experience (how customers feel and behave).",
            analogy="A car dashboard: speed, fuel and engine warnings each have their own place, so you know where to look.",
            example={"kind": "text", "code": "A gym's dashboard\nRevenue:        membership income · new sign-ups this month\nProfitability:  cost per member · profit margin\nCustomers:      class satisfaction · members renewing", "caption": "Different business, same three questions."},
            whyItMatters="Grouped KPIs let decision-makers answer “are we selling, are we keeping money, are customers happy?” in seconds.",
            commonMistake="Grouping numbers by where they came from (which spreadsheet or team) instead of the question they answer.",
            takeaway="For each KPI, ask: money in, money kept, or customer experience?",
        )),
        ("chart", lesson(
            "lesson-charts", "Learn: choosing the right chart", "astrid", ["choose-visual"],
            concept="Choosing the right chart",
            objective="Match a chart type to the question being asked.",
            plainEnglish="Match the chart to the question. For change over time, use a line chart. To compare categories, use a bar chart. For parts of a whole with only a few parts, use a pie or stacked bar. For one headline number, use a big number card.",
            analogy="Choosing a map: a road map for driving and a tube map for the Underground. Both are maps, but each answers a different question.",
            example={"kind": "text", "code": "Question                               Chart\nWhich shop sold the most?              Bar chart\nWhat share of orders came online?      Pie or stacked bar (few parts)\nHow many members do we have today?     Big number card"},
            whyItMatters="The right chart makes the answer obvious; the wrong one hides it.",
            commonMistake="A pie chart with many similar slices, which makes differences almost impossible to see.",
            takeaway="Time → line, compare → bar, share → pie (few parts), headline → number.",
        )),
    ],
}

PHASES = {
    "missing-signal": {"find-source": "guided", "assemble": "assessment"},
    "the-ledger": {"filter-north": "guided", "interpret": "assessment"},
    "broken-tally": {"fix-print": "guided", "predict": "assessment"},
    "market-ledger": {"row-revenue": "guided", "absolute": "assessment"},
    "great-hall-dashboard": {"chart": "guided", "tradeoff": "assessment"},
}

for quest_id, items in LESSONS.items():
    path = QUESTS / f"{quest_id}.json"
    quest = json.loads(path.read_text())
    ids = [s["id"] for s in quest["scenes"]]
    for before, scene in items:
        if scene["id"] in ids:
            continue
        index = next(i for i, s in enumerate(quest["scenes"]) if s["id"] == before)
        quest["scenes"].insert(index, scene)
        ids = [s["id"] for s in quest["scenes"]]
    for scene in quest["scenes"]:
        if scene["id"] in PHASES.get(quest_id, {}):
            scene["phase"] = PHASES[quest_id][scene["id"]]
    path.write_text(json.dumps(quest, indent=2, ensure_ascii=False) + "\n")
    print(quest_id, [s["id"] for s in quest["scenes"]])
