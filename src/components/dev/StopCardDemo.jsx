import RoadTripStopCard from "../results/RoadTripStopCard.jsx";

const FOOD_IMG = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=128&h=128&fit=crop&q=80";
const FUEL_IMG = "https://images.unsplash.com/photo-1565008576549-57569a49371d?w=128&h=128&fit=crop&q=80";
const LODGING_IMG = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=128&h=128&fit=crop&q=80";

/** Dev/preview fixture — render at /?stopCards=1 for visual QA. */
export default function StopCardDemo() {
  return (
    <div className="app-wrap day theme-day" data-surface-theme="day">
      <main className="stop-card-demo">
        <div className="stop-card-demo-inner">
        <RoadTripStopCard
          signCategory="food"
          categoryLabel="Food"
          name="Sunset Chrome Diner"
          rating={4.6}
          distance="0.3 mi off route"
          verified
          actions={[
            { label: "Get directions", variant: "primary", onClick: () => {} },
            { label: "Menu", variant: "secondary", onClick: () => {} },
            { label: "Website", variant: "secondary", onClick: () => {} },
          ]}
          photo={<img className="road-stop-card-photo" src={FOOD_IMG} alt="" />}
        />
        <RoadTripStopCard
          signCategory="fuel"
          categoryLabel="Fuel"
          name="Whiting Bros. Service"
          rating={4.2}
          distance="On route"
          verified
          actions={[
            { label: "Get directions", variant: "primary", onClick: () => {} },
            { label: "Website", variant: "secondary", onClick: () => {} },
          ]}
          photo={<img className="road-stop-card-photo" src={FUEL_IMG} alt="" />}
        />
        <RoadTripStopCard
          signCategory="lodging"
          categoryLabel="Lodging"
          name="Blue Swallow Motel"
          rating={4.8}
          distance="1.1 mi off route"
          verified
          actions={[
            { label: "Choose stay", variant: "primary", onClick: () => {} },
            { label: "Get directions", variant: "secondary", onClick: () => {} },
            { label: "View listing", variant: "secondary", onClick: () => {} },
          ]}
          photo={<img className="road-stop-card-photo" src={LODGING_IMG} alt="" />}
        />
        </div>
      </main>
    </div>
  );
}
